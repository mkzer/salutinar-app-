import { useEffect } from 'react';

/**
 * useAntiScreenshot — multi-layer defense against screen capture.
 *
 * Layer 1: Block OS-level screenshot shortcuts
 * Layer 2: Detect DevTools open (disable image loading)
 * Layer 3: Block right-click / drag
 * Layer 4: CSS pointer-events + user-select
 * Layer 5: Visibility API (black out when tab hidden/unfocused)
 */
export default function useAntiScreenshot(setBlackout) {
  useEffect(() => {
    // ── Layer 1: Screenshot keyboard shortcuts ──────────────────────────────
    const blockedKeys = new Set([
      'PrintScreen',      // Windows PrtSc
      'F12',              // DevTools
      'F11',              // Fullscreen (can be used with screen capture)
    ]);

    const handleKeyDown = (e) => {
      // Block PrtSc
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        e.stopPropagation();
        setBlackout(true);
        setTimeout(() => setBlackout(false), 2000);
        return false;
      }

      // Block Ctrl+Shift+I (DevTools), Ctrl+Shift+C, Ctrl+U (View Source)
      if (e.ctrlKey || e.metaKey) {
        if (
          (e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c' || e.key === 'J' || e.key === 'j')) ||
          e.key === 'U' || e.key === 'u' ||
          e.key === 'S' || e.key === 's' || // Ctrl+S save page
          e.key === 'P' || e.key === 'p'    // Ctrl+P print
        ) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }

      if (blockedKeys.has(e.key)) {
        e.preventDefault();
        return false;
      }
    };

    // ── Layer 2: Right-click ────────────────────────────────────────────────
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // ── Layer 3: Drag prevention ────────────────────────────────────────────
    const handleDragStart = (e) => {
      e.preventDefault();
      return false;
    };

    // ── Layer 4: Visibility API — black out when window loses focus ─────────
    // This catches Alt+PrtSc and screen recording start detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setBlackout(true);
      } else {
        // Small delay so the screen capture gets the blackout frame
        setTimeout(() => setBlackout(false), 500);
      }
    };

    const handleWindowBlur = () => {
      setBlackout(true);
    };

    const handleWindowFocus = () => {
      setTimeout(() => setBlackout(false), 300);
    };

    // ── Layer 5: DevTools size detection ───────────────────────────────────
    // Heuristic: if window is significantly narrower than screen, devtools may be open
    let devtoolsCheckInterval;
    const checkDevTools = () => {
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > threshold || heightDiff > threshold) {
        setBlackout(true);
      }
    };
    devtoolsCheckInterval = setInterval(checkDevTools, 1000);

    // Register all listeners
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
    document.addEventListener('dragstart', handleDragStart, { capture: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    // Inject CSS protections
    const style = document.createElement('style');
    style.id = 'anti-screenshot-styles';
    style.textContent = `
      * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      img, canvas {
        pointer-events: none !important;
        -webkit-user-drag: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('dragstart', handleDragStart, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      clearInterval(devtoolsCheckInterval);
      document.getElementById('anti-screenshot-styles')?.remove();
    };
  }, [setBlackout]);
}
