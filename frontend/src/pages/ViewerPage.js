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
    height: '100px',
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
  },
  sendBtn: {
    position: 'fixed',
    bottom: '120px',
    right: '2rem',
    padding: '0.8rem 1.8rem',
    background: '#c9a96e',
    border: 'none',
    color: '#080808',
    fontSize: '0.7rem',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: "'Jost', sans-serif",
    fontWeight: 500,
    zIndex: 20,
    transition: 'all 0.2s',
    boxShadow: '0 4px 20px rgba(201,169,110,0.3)',
  },
};

export default function ViewerPage() {
  const { archiveId } = useParams();
  const [phase, setPhase] = useState('loading');
  const [archiveInfo, setArchiveInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [token, setToken] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageCount, setImageCount] = useState(0);
  const [clientName, setClientName] = useState('');
  const [isBlackout, setIsBlackout] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [sendStatus, setSendStatus] = useState(null); // null | 'sending' | 'done' | 'error'
  const imageCache = useRef({});

  useAntiScreenshot(setIsBlackout);

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

  const getImageUrl = useCallback((index) => {
    if (!token) return null;
    return `${API}/api/view/${archiveId}/image/${index}?t=${encodeURIComponent(token)}`;
  }, [token, archiveId]);

  useEffect(() => {
    if (!token || imageCount === 0) return;
    const preload = (idx) => {
      if (idx < 0 || idx >= imageCount) return;
      if (imageCache.current[idx]) return;
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

  const toggleSelect = (i, e) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0 || sendStatus === 'sending') return;
    setSendStatus('sending');
    try {
      const res = await fetch(`${API}/api/view/${archiveId}/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ selectedIndexes: Array.from(selected) })
      });
      setSendStatus(res.ok ? 'done' : 'error');
    } catch {
      setSendStatus('error');
    }
    setTimeout(() => setSendStatus(null), 4000);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, imageCount]);

  if (isBlackout) {
    return <div style={styles.blackout}>CONTENU PROTÉGÉ</div>;
  }

  if (phase === 'loading') {
    return (
      <div style={styles.root}>
        <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: '#333', textTransform: 'uppercase' }}>
          Chargement…
        </div>
      </div>
    );
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {selected.size > 0 && (
            <span style={{ fontSize: '0.7rem', color: '#c9a96e', letterSpacing: '0.1em' }}>
              {selected.size} sélectionnée{selected.size > 1 ? 's' : ''}
            </span>
          )}
          <div style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em' }}>
            {currentIndex + 1} <span style={{ color: '#2a2a2a' }}>/</span> {imageCount}
          </div>
        </div>
      </div>

      {/* Image area */}
      <div style={styles.imageArea}>
        <div style={styles.watermark}>{clientName}</div>

        {imageLoading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 3, pointerEvents: 'none'
          }}>
            <div style={{ width: '2px', height: '40px', background: '#c9a96e', opacity: 0.5 }} />
          </div>
        )}

        <WebGLViewer
          imageUrl={getImageUrl(currentIndex)}
          onLoad={() => setImageLoading(false)}
        />

        {/* Checkbox sur l'image principale */}
        <div
          onClick={(e) => toggleSelect(currentIndex, e)}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 6,
            cursor: 'pointer',
            width: '28px',
            height: '28px',
            border: `2px solid ${selected.has(currentIndex) ? '#c9a96e' : '#444'}`,
            background: selected.has(currentIndex) ? '#c9a96e' : 'rgba(0,0,0,0.5)',
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          {selected.has(currentIndex) && (
            <span style={{ color: '#080808', fontSize: '1rem', fontWeight: 700, lineHeight: 1 }}>✓</span>
          )}
        </div>

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
            style={{
              position: 'relative',
              width: '64px',
              height: '80px',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            <div
              onClick={() => { setImageLoading(true); setCurrentIndex(i); }}
              style={{
                width: '64px',
                height: '64px',
                border: i === currentIndex ? '1px solid #c9a96e' : selected.has(i) ? '1px solid #c9a96e88' : '1px solid #1e1e1e',
                background: '#111',
                overflow: 'hidden',
                transition: 'all 0.2s',
              }}
            >
              <img
                src={getImageUrl(i)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }}
                draggable={false}
                onContextMenu={e => e.preventDefault()}
              />
              {selected.has(i) && (
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: '64px',
                  background: 'rgba(201,169,110,0.15)',
                  pointerEvents: 'none',
                }} />
              )}
            </div>
            {/* Checkbox sous la thumbnail */}
            <div
              onClick={(e) => toggleSelect(i, e)}
              style={{
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: '12px',
                height: '12px',
                border: `1px solid ${selected.has(i) ? '#c9a96e' : '#333'}`,
                background: selected.has(i) ? '#c9a96e' : 'transparent',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {selected.has(i) && <span style={{ color: '#080808', fontSize: '9px', lineHeight: 1, fontWeight: 700 }}>✓</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bouton envoyer — visible si sélection non vide */}
      {selected.size > 0 && (
        <button
          onClick={handleSend}
          disabled={sendStatus === 'sending' || sendStatus === 'done'}
          style={{
            ...styles.sendBtn,
            opacity: sendStatus === 'sending' ? 0.7 : 1,
            background: sendStatus === 'done' ? '#4caf50' : sendStatus === 'error' ? '#c0392b' : '#c9a96e',
          }}
        >
          {sendStatus === 'sending' && 'Envoi…'}
          {sendStatus === 'done' && '✓ Sélection envoyée'}
          {sendStatus === 'error' && 'Erreur — réessayer'}
          {!sendStatus && `Envoyer ma sélection (${selected.size})`}
        </button>
      )}
    </div>
  );
}
