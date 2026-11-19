import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
  );
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const useIsWide = () => useMediaQuery('(min-width: 640px)');

/** Aktualny czas, odświeżany co `ms` (domyślnie 30 s) i po powrocie do karty. */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, ms);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ms]);
  return now;
}

// ——— Stos „wstecz” (przycisk wstecz na Androidzie i Esc) ———
type BackHandler = { id: number; fn: () => void };
const backStack: BackHandler[] = [];
let backSeq = 1;

/** Zarejestruj zamykanie (np. arkusza) – najnowszy wpis obsługuje „wstecz”. */
export function useBackHandler(active: boolean, onBack: () => void) {
  const fnRef = useRef(onBack);
  fnRef.current = onBack;
  useEffect(() => {
    if (!active) return;
    const entry: BackHandler = { id: backSeq++, fn: () => fnRef.current() };
    backStack.push(entry);
    return () => {
      const i = backStack.findIndex((e) => e.id === entry.id);
      if (i >= 0) backStack.splice(i, 1);
    };
  }, [active]);
}

/** Zwraca true, jeśli coś zostało zamknięte. */
export function popBack(): boolean {
  const top = backStack[backStack.length - 1];
  if (!top) return false;
  top.fn();
  return true;
}

export function hasBackHandlers() {
  return backStack.length > 0;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && popBack()) e.preventDefault();
});
