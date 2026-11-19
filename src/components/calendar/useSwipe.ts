import { useEffect, type RefObject } from 'react';
import { cancelPendingDrag, isDragActive } from './drag';

/**
 * Swipe w lewo/prawo między dniami/tygodniami/miesiącami.
 * Treść podąża za palcem (`target`), po puszczeniu – nawigacja albo powrót.
 */
export function useSwipeNav(
  container: RefObject<HTMLElement | null>,
  target: RefObject<HTMLElement | null>,
  onSwipe: (dir: 1 | -1) => void,
) {
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let mode: 'h' | 'v' | null = null;
    let dx = 0;
    let tracking = false;

    const setX = (x: number, animate = false) => {
      const t = target.current;
      if (!t) return;
      t.style.transition = animate ? 'transform 0.22s cubic-bezier(0.22,1,0.36,1), opacity 0.22s ease' : 'none';
      t.style.transform = x ? `translate3d(${x}px,0,0)` : '';
      t.style.opacity = x ? String(Math.max(0.35, 1 - Math.abs(x) / 600)) : '';
    };

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isDragActive()) return;
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      t0 = performance.now();
      mode = null;
      dx = 0;
      tracking = true;
    };
    const move = (e: TouchEvent) => {
      if (!tracking) return;
      if (isDragActive()) {
        tracking = false;
        setX(0);
        return;
      }
      const t = e.touches[0];
      dx = t.clientX - x0;
      const dy = t.clientY - y0;
      if (!mode) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          mode = 'h';
          cancelPendingDrag();
        } else if (Math.abs(dy) > 12) mode = 'v';
      }
      if (mode === 'h') setX(dx * 0.85);
    };
    const end = () => {
      if (!tracking) return;
      tracking = false;
      if (mode !== 'h') return;
      const v = Math.abs(dx) / Math.max(1, performance.now() - t0);
      if (Math.abs(dx) > 70 || (v > 0.45 && Math.abs(dx) > 30)) {
        const dir = dx < 0 ? 1 : -1;
        setX(-dir * 0); // reset – nowa treść wjedzie animacją
        onSwipe(dir);
      } else setX(0, true);
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [container, target, onSwipe]);
}
