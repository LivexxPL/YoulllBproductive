/**
 * Powiadomienia w przeglądarce.
 *
 * UWAGA: przeglądarka nie potrafi zaplanować powiadomienia „na później”, gdy
 * strona jest zamknięta. Dlatego harmonogram działa tylko przy otwartej karcie
 * (także w tle). Do pewnych przypomnień służy aplikacja na Androida.
 */
import type { Alarm } from './alarms';

const FIRED_KEY = 'ybp-fired';
/** Ile wstecz alarm jest jeszcze „świeży” (np. po wybudzeniu komputera). */
const GRACE_MS = 3 * 60_000;

export type WebPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function webPermission(): WebPermission {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestWebPermission(): Promise<WebPermission> {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

let swReg: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  try {
    swReg = await navigator.serviceWorker.register('/sw.js');
  } catch (e) {
    console.warn('[sw] rejestracja nieudana', e);
  }
}

function loadFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveFired(map: Record<string, number>) {
  const cutoff = Date.now() - 3 * 86_400_000;
  for (const k of Object.keys(map)) if (map[k] < cutoff) delete map[k];
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {
    /* pełny storage */
  }
}

export async function showWebNotification(a: Pick<Alarm, 'key' | 'title' | 'body' | 'reminderId' | 'occurrence'>) {
  if (webPermission() !== 'granted') return;
  const options: NotificationOptions & { renotify?: boolean; actions?: Array<{ action: string; title: string }>; vibrate?: number[] } = {
    body: a.body,
    tag: a.key,
    renotify: true,
    requireInteraction: true,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [300, 150, 300, 150, 600],
    data: { reminderId: a.reminderId, occurrence: a.occurrence },
    actions: [
      { action: 'done', title: '✓ Zrobione' },
      { action: 'snooze15', title: '⏰ Drzemka 15 min' },
    ],
  };
  try {
    const reg = swReg ?? (await navigator.serviceWorker?.getRegistration());
    if (reg) {
      await reg.showNotification(a.title, options);
      return;
    }
  } catch {
    /* spróbuj zwykłego API */
  }
  try {
    const { actions: _a, ...plain } = options;
    void _a;
    const n = new Notification(a.title, plain);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (e) {
    console.warn('[notify]', e);
  }
}

/**
 * Harmonogram w karcie. Tyka w Web Workerze (mniej dławiony w tle niż setInterval
 * na głównym wątku), sprawdza co 5 s, czy coś ma „zadzwonić”.
 */
export class WebScheduler {
  private alarms: Alarm[] = [];
  private worker: Worker | null = null;
  private interval: number | null = null;
  private onFire: (a: Alarm) => void;

  constructor(onFire: (a: Alarm) => void) {
    this.onFire = onFire;
  }

  start() {
    const tick = () => this.check();
    try {
      const src = 'setInterval(() => postMessage(0), 5000);';
      this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      this.worker.onmessage = tick;
    } catch {
      this.interval = window.setInterval(tick, 5000);
    }
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    tick();
  }

  stop() {
    this.worker?.terminate();
    if (this.interval) window.clearInterval(this.interval);
  }

  setAlarms(alarms: Alarm[]) {
    this.alarms = alarms;
    this.check();
  }

  private check() {
    const now = Date.now();
    const fired = loadFired();
    let changed = false;
    for (const a of this.alarms) {
      const t = a.at.getTime();
      if (t > now) break; // posortowane rosnąco
      const id = `${a.key}|${t}`;
      if (fired[id]) continue;
      fired[id] = now;
      changed = true;
      if (now - t <= GRACE_MS) this.onFire(a);
    }
    if (changed) saveFired(fired);
  }
}
