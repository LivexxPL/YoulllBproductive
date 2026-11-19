import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePref = 'system' | 'light' | 'dark';
export type CalendarView = 'day' | 'week' | 'month';

export interface SettingsState {
  theme: ThemePref;
  weekStartsOn: 0 | 1;
  /** Głośny alarm: na Androidzie kanał z dźwiękiem alarmu, w przeglądarce dźwięk w pętli. */
  loudAlarms: boolean;
  /** Dźwięk w aplikacji/przeglądarce przy alarmie. */
  soundEnabled: boolean;
  /** Godzina powiadomienia dla wpisów całodniowych. */
  allDayAlarmTime: string;
  defaultDurationMin: number;
  calendarView: CalendarView;
  /** Czy pokazywać baner o powiadomieniach w przeglądarce. */
  webNoticeDismissed: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      weekStartsOn: 1,
      loudAlarms: true,
      soundEnabled: true,
      allDayAlarmTime: '09:00',
      defaultDurationMin: 30,
      calendarView: 'week',
      webNoticeDismissed: false,
      set: (patch) => set(patch),
    }),
    { name: 'ybp-settings', version: 1 },
  ),
);

export function settingsSnapshot(): Record<string, unknown> {
  const { set: _set, ...rest } = useSettings.getState();
  void _set;
  return rest;
}
