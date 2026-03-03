const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin123', 10);

// Storage paths
const UPLOADS_DIR = path.join(__dirname, 'data', 'uploads');
const ARCHIVES_DIR = path.join(__dirname, 'data', 'archives');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(ARCHIVES_DIR, { recursive: true });

// Simple JSON DB
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const loadDB = () => {
  if (!fs.existsSync(DB_PATH)) return { archives: {} };
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
};
const saveDB = (db) => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ─── Multer config ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.zip', '.tar', '.gz', '.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// ─── Auth middleware ──────────────────────────────────────────────────────────
const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error('Not admin');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Admin login
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!valid) return res.status(401).json({ error: 'Wrong password' });
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// Upload archive
app.post('/api/archives', adminAuth, upload.single('archive'), async (req, res) => {
  try {
    const { clientName, password, expiresInDays } = req.body;
    if (!clientName || !password || !req.file) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const archiveId = uuidv4();
    const archiveDir = path.join(ARCHIVES_DIR, archiveId);
    fs.mkdirSync(archiveDir, { recursive: true });

    // Extract images from zip/tar or handle single image
    const ext = path.extname(req.file.originalname).toLowerCase();
    let imageFiles = [];

    if (ext === '.zip') {
      const zip = new AdmZip(req.file.path);
      const entries = zip.getEntries();
      for (const entry of entries) {
        const entryExt = path.extname(entry.entryName).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(entryExt) && !entry.isDirectory) {
          const imgName = `${imageFiles.length.toString().padStart(4, '0')}${entryExt}`;
          const imgPath = path.join(archiveDir, imgName);
          zip.extractEntryTo(entry, archiveDir, false, true, false, imgName);
          // Resize to max 2400px wide for performance, strip EXIF
          await sharp(imgPath)
            .resize({ width: 2400, withoutEnlargement: true })
            .toFile(imgPath + '.opt.jpg')
            .catch(() => {});
          if (fs.existsSync(imgPath + '.opt.jpg')) {
            fs.renameSync(imgPath + '.opt.jpg', imgPath.replace(entryExt, '.jpg'));
            if (imgPath.replace(entryExt, '.jpg') !== imgPath) fs.unlinkSync(imgPath);
          }
          imageFiles.push(path.basename(imgPath.replace(entryExt, '.jpg')));
        }
      }
    } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      const imgName = `0001${ext}`;
      fs.copyFileSync(req.file.path, path.join(archiveDir, imgName));
      imageFiles.push(imgName);
    }

    // Cleanup upload
    fs.unlinkSync(req.file.path);

    if (imageFiles.length === 0) {
      fs.rmSync(archiveDir, { recursive: true });
      return res.status(400).json({ error: 'No valid images found in archive' });
    }

    // Sort images
    imageFiles.sort();

    // Store in DB
    const passwordHash = await bcrypt.hash(password, 10);
    const expiresAt = expiresInDays
      ? new Date(Date.now() + parseInt(expiresInDays) * 86400000).toISOString()
      : null;

    const db = loadDB();
    db.archives[archiveId] = {
      id: archiveId,
      clientName,
      passwordHash,
      imageCount: imageFiles.length,
      images: imageFiles,
      expiresAt,
      createdAt: new Date().toISOString(),
      active: true
    };
    saveDB(db);

    res.json({
      archiveId,
      clientName,
      imageCount: imageFiles.length,
      shareUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/view/${archiveId}`,
      expiresAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// List archives (admin)
app.get('/api/archives', adminAuth, (req, res) => {
  const db = loadDB();
  const archives = Object.values(db.archives).map(a => ({
    id: a.id,
    clientName: a.clientName,
    imageCount: a.imageCount,
    createdAt: a.createdAt,
    expiresAt: a.expiresAt,
    active: a.active
  }));
  res.json(archives);
});

// Delete archive
app.delete('/api/archives/:id', adminAuth, (req, res) => {
  const db = loadDB();
  const archive = db.archives[req.params.id];
  if (!archive) return res.status(404).json({ error: 'Not found' });

  // Delete files
  const archiveDir = path.join(ARCHIVES_DIR, req.params.id);
  if (fs.existsSync(archiveDir)) fs.rmSync(archiveDir, { recursive: true });

  // Remove from DB
  delete db.archives[req.params.id];
  saveDB(db);

  res.json({ success: true });
});

// Client auth — get short-lived image token
app.post('/api/view/:archiveId/auth', async (req, res) => {
  const { password } = req.body;
  const db = loadDB();
  const archive = db.archives[req.params.archiveId];

  if (!archive || !archive.active) return res.status(404).json({ error: 'Archive not found' });
  if (archive.expiresAt && new Date(archive.expiresAt) < new Date()) {
    return res.status(410).json({ error: 'Link expired' });
  }

  const valid = await bcrypt.compare(password, archive.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Wrong password' });

  // Token valid 2h, tied to archiveId + client IP
  const token = jwt.sign(
    { archiveId: req.params.archiveId, role: 'client', ip: req.ip },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  res.json({
    token,
    imageCount: archive.imageCount,
    clientName: archive.clientName
  });
});

// Serve image — requires valid client token
// Images are served as data URLs via /api/view/:archiveId/image/:index
app.get('/api/view/:archiveId/image/:index', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1] || req.query.t;
  if (!token) return res.status(401).json({ error: 'No token' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (payload.archiveId !== req.params.archiveId) {
    return res.status(403).json({ error: 'Token mismatch' });
  }

  const db = loadDB();
  const archive = db.archives[req.params.archiveId];
  if (!archive || !archive.active) return res.status(404).json({ error: 'Not found' });
  if (archive.expiresAt && new Date(archive.expiresAt) < new Date()) {
    return res.status(410).json({ error: 'Expired' });
  }

  const index = parseInt(req.params.index);
  if (index < 0 || index >= archive.images.length) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const imgPath = path.join(ARCHIVES_DIR, req.params.archiveId, archive.images[index]);
  if (!fs.existsSync(imgPath)) return res.status(404).json({ error: 'File missing' });

  // Security headers — prevent caching, prevent embedding
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Frame-Options', 'DENY');

  res.sendFile(imgPath);
});

// Archive info (public — no password)
app.get('/api/view/:archiveId/info', (req, res) => {
  const db = loadDB();
  const archive = db.archives[req.params.archiveId];
  if (!archive || !archive.active) return res.status(404).json({ error: 'Not found' });
  if (archive.expiresAt && new Date(archive.expiresAt) < new Date()) {
    return res.status(410).json({ error: 'Expired' });
  }
  res.json({ clientName: archive.clientName, imageCount: archive.imageCount });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
