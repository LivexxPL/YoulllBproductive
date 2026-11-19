import { create } from 'zustand';
import { stopAlarm } from '../lib/sound';

export interface ActiveAlarm {
  key: string;
  reminderId: string;
  occurrence: string;
  title: string;
  at: string;
}

interface AlarmState {
  queue: ActiveAlarm[];
  push: (a: ActiveAlarm) => void;
  dismiss: (key: string) => void;
  clear: () => void;
}

let titleTimer: number | null = null;
let baseTitle = document.title;

function startTitleFlash(text: string) {
  if (titleTimer) return;
  baseTitle = document.title;
  let on = false;
  titleTimer = window.setInterval(() => {
    on = !on;
    document.title = on ? `🔔 ${text}` : baseTitle;
  }, 900);
}

function stopTitleFlash() {
  if (titleTimer) window.clearInterval(titleTimer);
  titleTimer = null;
  document.title = baseTitle;
}

/** Kolejka alarmów pokazywanych w aplikacji (pełnoekranowe okno). */
export const useAlarms = create<AlarmState>()((set, get) => ({
  queue: [],
  push: (a) => {
    if (get().queue.some((x) => x.key === a.key)) return;
    set((s) => ({ queue: [...s.queue, a] }));
    startTitleFlash(a.title);
  },
  dismiss: (key) => {
    const queue = get().queue.filter((x) => x.key !== key);
    set({ queue });
    if (!queue.length) {
      stopAlarm();
      stopTitleFlash();
    }
  },
  clear: () => {
    set({ queue: [] });
    stopAlarm();
    stopTitleFlash();
  },
}));
