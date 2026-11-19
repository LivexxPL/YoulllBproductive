import { useEffect, type RefObject } from 'react';
import { haptic } from '../../lib/platform';

/**
 * Przeciąganie wydarzeń: myszą od razu (po 4 px), palcem po przytrzymaniu (~350 ms),
 * żeby zwykłe przewijanie kalendarza dalej działało.
 */
export interface DragCallbacks {
  onStart: (p: { x: number; y: number }) => void;
  onMove: (p: { x: number; y: number }) => void;
  onEnd: (p: { x: number; y: number }, cancelled: boolean) => void;
  onTap?: () => void;
}

let active = false;
let pendingCancel: (() => void) | null = null;

export const isDragActive = () => active;

/** Przerwij oczekujące „przytrzymanie” (np. gdy zaczął się swipe). */
export function cancelPendingDrag() {
  pendingCancel?.();
}

export function startPointerDrag(e: React.PointerEvent, cb: DragCallbacks, opts: { longPressMs?: number } = {}) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const isMouse = e.pointerType === 'mouse';
  const x0 = e.clientX;
  const y0 = e.clientY;
  const id = e.pointerId;
  let started = false;
  let timer: number | null = null;
  let last = { x: x0, y: y0 };

  const cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    if (timer) window.clearTimeout(timer);
    timer = null;
    pendingCancel = null;
    if (started) {
      // „Zjedz” klik po przeciągnięciu
      const stop = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', stop, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 50);
    }
    active = false;
    document.body.classList.remove('dragging');
  };

  const begin = () => {
    started = true;
    active = true;
    document.body.classList.add('dragging');
    if (!isMouse) haptic('medium');
    cb.onStart(last);
  };

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    last = { x: ev.clientX, y: ev.clientY };
    const dist = Math.hypot(ev.clientX - x0, ev.clientY - y0);
    if (!started) {
      if (isMouse) {
        if (dist > 4) begin();
        else return;
      } else {
        if (dist > 9) cleanup(); // to było przewijanie, nie przytrzymanie
        return;
      }
    }
    cb.onMove(last);
  };

  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    const wasStarted = started;
    cleanup();
    if (wasStarted) cb.onEnd({ x: ev.clientX, y: ev.clientY }, false);
    else cb.onTap?.();
  };

  const cancel = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    const wasStarted = started;
    cleanup();
    if (wasStarted) cb.onEnd(last, true);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  pendingCancel = () => {
    if (!started) cleanup();
  };
  if (!isMouse) timer = window.setTimeout(begin, opts.longPressMs ?? 350);
}

/**
 * Blokuje przewijanie palcem, gdy trwa przeciąganie wydarzenia.
 * Listener jest niepasywny i rejestrowany zawczasu – inaczej Chrome go zignoruje.
 */
export function useBlockTouchScrollWhileDragging(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (ev: TouchEvent) => {
      if (active && ev.cancelable) ev.preventDefault();
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, [ref]);
}
