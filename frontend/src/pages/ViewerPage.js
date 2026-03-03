import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import WebGLViewer from '../components/WebGLViewer';
import useAntiScreenshot from '../hooks/useAntiScreenshot';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const styles = {
  root: {
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#e8e0d8',
    fontFamily: "'Jost', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '3rem 2.5rem',
    border: '1px solid #1e1e1e',
    borderRadius: '2px',
  },
  heading: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '2.4rem',
    fontWeight: 300,
    letterSpacing: '0.04em',
    marginBottom: '0.3rem',
    color: '#e8e0d8',
  },
  subheading: {
    fontSize: '0.75rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#555',
    marginBottom: '2.5rem',
  },
  label: {
    display: 'block',
    fontSize: '0.7rem',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: '#666',
    marginBottom: '0.6rem',
  },
  input: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #2a2a2a',
    padding: '0.7rem 0',
    color: '#e8e0d8',
    fontSize: '1rem',
    fontFamily: "'Jost', sans-serif",
    outline: 'none',
    transition: 'border-color 0.3s',
  },
  button: {
    width: '100%',
    marginTop: '2rem',
    padding: '0.85rem',
    background: 'transparent',
    border: '1px solid #c9a96e',
    color: '#c9a96e',
    fontSize: '0.75rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: "'Jost', sans-serif",
    transition: 'all 0.3s',
  },
  error: {
    marginTop: '1rem',
    color: '#c0392b',
    fontSize: '0.8rem',
    textAlign: 'center',
    letterSpacing: '0.1em',
  },
  // Gallery styles
  gallery: {
    position: 'fixed',
    inset: 0,
    background: '#080808',
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    borderBottom: '1px solid #181818',
    zIndex: 10,
    flexShrink: 0,
  },
  imageArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  navigation: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid #2a2a2a',
    color: '#888',
    width: '48px',
    height: '80px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    transition: 'all 0.2s',
    zIndex: 5,
    userSelect: 'none',
  },
  thumbnailStrip: {
    height: '80px',
    display: 'flex',
    gap: '4px',
    padding: '8px 1rem',
    overflowX: 'auto',
    borderTop: '1px solid #181818',
    flexShrink: 0,
    scrollbarWidth: 'thin',
    scrollbarColor: '#2a2a2a transparent',
  },
  blackout: {
    position: 'fixed',
    inset: 0,
    background: '#000',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#111',
    fontSize: '0.8rem',
    letterSpacing: '0.2em',
    pointerEvents: 'all',
  },
  watermark: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 4,
    transform: 'rotate(-30deg)',
    opacity: 0.07,
    fontSize: '3rem',
    fontFamily: "'Cormorant Garamond', serif",
    color: '#fff',
    userSelect: 'none',
    letterSpacing: '0.15em',
    whiteSpace: 'nowrap',
  }
};

export default function ViewerPage() {
  const { archiveId } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | login | gallery | error
  const [archiveInfo, setArchiveInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [token, setToken] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [clientName, setClientName] = useState('');
  const [isBlackout, setIsBlackout] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const imageCache = useRef({});

  useAntiScreenshot(setIsBlackout);

  // Load archive info
  useEffect(() => {
    fetch(`${API}/api/view/${archiveId}/info`)
      .then(r => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then(data => {
        setArchiveInfo(data);
        setPhase('login');
      })
      .catch(() => setPhase('error'));
  }, [archiveId]);

  // Build authenticated image URL
  const getImageUrl = useCallback((index) => {
    if (!token) return null;
    return `${API}/api/view/${archiveId}/image/${index}?t=${encodeURIComponent(token)}`;
  }, [token, archiveId]);

  // Preload adjacent images
  useEffect(() => {
    if (!token || imageCount === 0) return;
    const preload = (idx) => {
      if (idx < 0 || idx >= imageCount) return;
      if (imageCache.current[idx]) return;
      // Just trigger the browser to cache it
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = getImageUrl(idx);
      imageCache.current[idx] = true;
    };
    preload(currentIndex - 1);
    preload(currentIndex + 1);
  }, [currentIndex, token, imageCount, getImageUrl]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch(`${API}/api/view/${archiveId}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) {
        const err = await res.json();
        setAuthError(err.error === 'Link expired' ? 'Ce lien a expiré.' : 'Mot de passe incorrect.');
        return;
      }
      const data = await res.json();
      setToken(data.token);
      setImageCount(data.imageCount);
      setClientName(data.clientName);
      setPhase('gallery');
    } catch {
      setAuthError('Erreur de connexion au serveur.');
    }
  };

  const navigate = (dir) => {
    setImageLoading(true);
    setCurrentIndex(i => Math.max(0, Math.min(imageCount - 1, i + dir)));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (phase !== 'gallery') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate(1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigate(-1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, imageCount]);

  // ── Blackout overlay ────────────────────────────────────────────────────────
  if (isBlackout) {
    return <div style={styles.blackout}>CONTENU PROTÉGÉ</div>;
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={styles.root}>
        <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: '#333', textTransform: 'uppercase' }}>
          Chargement…
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div style={styles.root}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '5rem', color: '#1e1e1e', fontWeight: 300 }}>×</div>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555' }}>
            Lien invalide ou expiré
          </p>
        </div>
      </div>
    );
  }

  // ── Login ───────────────────────────────────────────────────────────────────
  if (phase === 'login') {
    return (
      <div style={styles.root}>
        <div style={styles.loginCard}>
          <h1 style={styles.heading}>{archiveInfo?.clientName || 'Galerie'}</h1>
          <p style={styles.subheading}>Sélection de photos · Accès protégé</p>

          <form onSubmit={handleLogin}>
            <label style={styles.label}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              autoFocus
            />
            {authError && <p style={styles.error}>{authError}</p>}
            <button
              type="submit"
              style={styles.button}
              onMouseEnter={e => { e.target.style.background = '#c9a96e22'; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; }}
            >
              Accéder à la galerie
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Gallery ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.gallery}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', fontWeight: 300 }}>
            {clientName}
          </span>
          <span style={{ marginLeft: '1rem', fontSize: '0.7rem', color: '#444', letterSpacing: '0.1em' }}>
            SÉLECTION PHOTOS
          </span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em' }}>
          {currentIndex + 1} <span style={{ color: '#2a2a2a' }}>/</span> {imageCount}
        </div>
      </div>

      {/* Image area */}
      <div style={styles.imageArea}>
        {/* Watermark */}
        <div style={styles.watermark}>{clientName}</div>

        {/* Loading indicator */}
        {imageLoading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 3, pointerEvents: 'none'
          }}>
            <div style={{ width: '2px', height: '40px', background: '#c9a96e', animation: 'none', opacity: 0.5 }} />
          </div>
        )}

        {/* WebGL Canvas Viewer */}
        <WebGLViewer
          imageUrl={getImageUrl(currentIndex)}
          onLoad={() => setImageLoading(false)}
        />

        {/* Navigation arrows */}
        {currentIndex > 0 && (
          <button
            style={{ ...styles.navigation, left: '1rem' }}
            onClick={() => navigate(-1)}
            onMouseEnter={e => { e.currentTarget.style.color = '#c9a96e'; e.currentTarget.style.borderColor = '#c9a96e44'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#2a2a2a'; }}
          >
            ‹
          </button>
        )}
        {currentIndex < imageCount - 1 && (
          <button
            style={{ ...styles.navigation, right: '1rem' }}
            onClick={() => navigate(1)}
            onMouseEnter={e => { e.currentTarget.style.color = '#c9a96e'; e.currentTarget.style.borderColor = '#c9a96e44'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#2a2a2a'; }}
          >
            ›
          </button>
        )}
      </div>

      {/* Thumbnail strip */}
      <div style={styles.thumbnailStrip}>
        {Array.from({ length: imageCount }, (_, i) => (
          <div
            key={i}
            onClick={() => { setImageLoading(true); setCurrentIndex(i); }}
            style={{
              width: '60px',
              height: '60px',
              flexShrink: 0,
              border: i === currentIndex ? '1px solid #c9a96e' : '1px solid #1e1e1e',
              cursor: 'pointer',
              background: '#111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.6rem',
              color: i === currentIndex ? '#c9a96e' : '#333',
              letterSpacing: '0.05em',
              transition: 'all 0.2s',
              overflow: 'hidden',
            }}
          >
            <img
              src={getImageUrl(i)}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }}
              draggable={false}
              onContextMenu={e => e.preventDefault()}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
