import React, { useState, useEffect, useRef } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const S = {
  root: { minHeight: '100vh', background: '#080808', color: '#e8e0d8', fontFamily: "'Jost', sans-serif", padding: '2rem' },
  header: { display: 'flex', alignItems: 'baseline', gap: '1.5rem', marginBottom: '3rem', borderBottom: '1px solid #141414', paddingBottom: '1.5rem' },
  title: { fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 300, color: '#e8e0d8' },
  section: { marginBottom: '3rem' },
  sectionTitle: { fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#555', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' },
  sectionLine: { flex: 1, height: '1px', background: '#141414' },
  card: { border: '1px solid #1a1a1a', padding: '2rem', maxWidth: '600px' },
  field: { marginBottom: '1.5rem' },
  label: { display: 'block', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555', marginBottom: '0.5rem' },
  input: { width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #222', padding: '0.6rem 0', color: '#e8e0d8', fontSize: '0.95rem', fontFamily: "'Jost', sans-serif", outline: 'none' },
  fileZone: { border: '1px dashed #222', padding: '2rem', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.3s', borderRadius: '1px' },
  btn: { padding: '0.75rem 2rem', background: 'transparent', border: '1px solid #c9a96e', color: '#c9a96e', fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Jost', sans-serif' ", transition: 'all 0.2s' },
  btnDanger: { padding: '0.4rem 0.9rem', background: 'transparent', border: '1px solid #c0392b44', color: '#c0392b88', fontSize: '0.65rem', letterSpacing: '0.1em', cursor: 'pointer', fontFamily: "'Jost', sans-serif", transition: 'all 0.2s' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#444', borderBottom: '1px solid #141414' },
  td: { padding: '0.9rem 1rem', fontSize: '0.85rem', borderBottom: '1px solid #111', verticalAlign: 'middle' },
  linkBox: { background: '#0e0e0e', border: '1px solid #1e1e1e', padding: '1rem 1.2rem', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' },
  link: { fontSize: '0.8rem', color: '#c9a96e', fontFamily: 'monospace', wordBreak: 'break-all' },
};

// Login screen
function AdminLogin({ onLogin }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      });
      if (!res.ok) { setErr('Mot de passe incorrect'); return; }
      const { token } = await res.json();
      onLogin(token);
    } catch { setErr('Erreur serveur'); }
  };
  return (
    <div style={{ ...S.root, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...S.card, maxWidth: '360px' }}>
        <h1 style={{ ...S.title, marginBottom: '0.5rem' }}>Administration</h1>
        <p style={{ fontSize: '0.7rem', color: '#444', letterSpacing: '0.1em', marginBottom: '2rem' }}>ACCÈS RÉSERVÉ</p>
        <form onSubmit={handleSubmit}>
          <div style={S.field}>
            <label style={S.label}>Mot de passe admin</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} style={S.input} autoFocus />
          </div>
          {err && <p style={{ color: '#c0392b', fontSize: '0.8rem', marginBottom: '1rem' }}>{err}</p>}
          <button type="submit" style={S.btn}>Connexion</button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem('adminToken'));
  const [archives, setArchives] = useState([]);
  const [form, setForm] = useState({ clientName: '', password: '', expiresInDays: '30' });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const fileRef = useRef();

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchArchives = async () => {
    try {
      const res = await fetch(`${API}/api/archives`, { headers: authHeaders });
      if (res.status === 401) { sessionStorage.removeItem('adminToken'); setToken(null); return; }
      const data = await res.json();
      setArchives(data);
    } catch {}
  };

  useEffect(() => {
    if (token) {
      sessionStorage.setItem('adminToken', token);
      fetchArchives();
    }
  }, [token]);

  const handleLogin = (t) => setToken(t);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !form.clientName || !form.password) { setError('Tous les champs sont requis.'); return; }
    setError('');
    setUploading(true);
    setUploadProgress(0);

    const fd = new FormData();
    fd.append('archive', file);
    fd.append('clientName', form.clientName);
    fd.append('password', form.password);
    fd.append('expiresInDays', form.expiresInDays);

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      await new Promise((resolve, reject) => {
        xhr.onload = resolve;
        xhr.onerror = reject;
        xhr.open('POST', `${API}/api/archives`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(fd);
      });
      const result = JSON.parse(xhr.responseText);
      if (xhr.status !== 200) { setError(result.error || 'Erreur upload'); setUploading(false); return; }
      setLastResult(result);
      setForm({ clientName: '', password: '', expiresInDays: '30' });
      setFile(null);
      fetchArchives();
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${API}/api/archives/${id}`, { method: 'DELETE', headers: authHeaders });
      setArchives(a => a.filter(x => x.id !== id));
      setDeleteConfirm(null);
    } catch { setError('Erreur suppression'); }
  };

  const copyLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!token) return <AdminLogin onLogin={handleLogin} />;

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>Galerie Admin</h1>
        <span style={{ fontSize: '0.65rem', color: '#333', letterSpacing: '0.15em' }}>TABLEAU DE BORD</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#333', letterSpacing: '0.1em', cursor: 'pointer' }}
          onClick={() => { sessionStorage.removeItem('adminToken'); setToken(null); }}>
          Déconnexion →
        </span>
      </div>

      {/* Upload form */}
      <div style={S.section}>
        <div style={S.sectionTitle}>
          Nouvelle galerie client
          <div style={S.sectionLine} />
        </div>

        <div style={S.card}>
          <form onSubmit={handleUpload}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={S.field}>
                <label style={S.label}>Nom de la cliente</label>
                <input style={S.input} value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Marie Dupont" />
              </div>
              <div style={S.field}>
                <label style={S.label}>Mot de passe</label>
                <input style={S.input} type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="mdp-secret-2024" />
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Expiration (jours, 0 = jamais)</label>
              <input style={{ ...S.input, maxWidth: '120px' }} type="number" min="0" value={form.expiresInDays} onChange={e => setForm(f => ({ ...f, expiresInDays: e.target.value }))} />
            </div>

            <div style={S.field}>
              <label style={S.label}>Archive (ZIP, JPG, PNG, WebP — max 200MB)</label>
              <div
                style={{ ...S.fileZone, borderColor: file ? '#c9a96e44' : '#1e1e1e' }}
                onClick={() => fileRef.current.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); }}
              >
                {file
                  ? <span style={{ color: '#c9a96e', fontSize: '0.85rem' }}>✓ {file.name}</span>
                  : <span style={{ color: '#333', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
                      Cliquer ou glisser-déposer le fichier ici
                    </span>
                }
                <input ref={fileRef} type="file" accept=".zip,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
              </div>
            </div>

            {error && <p style={{ color: '#c0392b', fontSize: '0.8rem', marginBottom: '1rem' }}>{error}</p>}

            {uploading && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ height: '2px', background: '#1a1a1a', marginBottom: '0.4rem' }}>
                  <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#c9a96e', transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: '0.7rem', color: '#555' }}>{uploadProgress}% — extraction en cours…</span>
              </div>
            )}

            <button type="submit" disabled={uploading} style={{ ...S.btn, opacity: uploading ? 0.5 : 1 }}>
              {uploading ? 'Envoi…' : 'Créer le lien'}
            </button>
          </form>

          {/* Last result */}
          {lastResult && (
            <div style={S.linkBox}>
              <div>
                <div style={{ fontSize: '0.6rem', color: '#555', letterSpacing: '0.15em', marginBottom: '0.4rem' }}>
                  LIEN CLIENT — {lastResult.imageCount} PHOTOS
                </div>
                <div style={S.link}>{lastResult.shareUrl}</div>
              </div>
              <button onClick={() => copyLink(lastResult.shareUrl)} style={{ ...S.btn, whiteSpace: 'nowrap', fontSize: '0.65rem' }}>
                {copied ? '✓ Copié' : 'Copier'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Archives list */}
      <div style={S.section}>
        <div style={S.sectionTitle}>
          Galeries actives ({archives.length})
          <div style={S.sectionLine} />
          <button onClick={fetchArchives} style={{ fontSize: '0.65rem', background: 'none', border: 'none', color: '#444', cursor: 'pointer', letterSpacing: '0.1em' }}>↻ Rafraîchir</button>
        </div>

        {archives.length === 0
          ? <p style={{ color: '#333', fontSize: '0.8rem', letterSpacing: '0.1em' }}>Aucune galerie pour l'instant.</p>
          : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Cliente</th>
                  <th style={S.th}>Photos</th>
                  <th style={S.th}>Créée le</th>
                  <th style={S.th}>Expire le</th>
                  <th style={S.th}>Lien</th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archives.map(a => (
                  <tr key={a.id}>
                    <td style={S.td}>{a.clientName}</td>
                    <td style={{ ...S.td, color: '#555' }}>{a.imageCount}</td>
                    <td style={{ ...S.td, color: '#444', fontSize: '0.75rem' }}>
                      {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td style={{ ...S.td, color: '#444', fontSize: '0.75rem' }}>
                      {a.expiresAt ? new Date(a.expiresAt).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ ...S.td }}>
                      <button
                        onClick={() => copyLink(`${process.env.REACT_APP_FRONTEND_URL || window.location.origin}/view/${a.id}`)}
                        style={{ background: 'none', border: 'none', color: '#c9a96e88', cursor: 'pointer', fontSize: '0.7rem', letterSpacing: '0.1em' }}>
                        ⧉ Copier
                      </button>
                    </td>
                    <td style={S.td}>
                      {deleteConfirm === a.id ? (
                        <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: '#c0392b', letterSpacing: '0.05em' }}>Confirmer ?</span>
                          <button onClick={() => handleDelete(a.id)} style={{ ...S.btnDanger, borderColor: '#c0392b88', color: '#c0392b' }}>Oui</button>
                          <button onClick={() => setDeleteConfirm(null)} style={S.btnDanger}>Non</button>
                        </span>
                      ) : (
                        <button onClick={() => setDeleteConfirm(a.id)} style={S.btnDanger}>Supprimer</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  );
}
