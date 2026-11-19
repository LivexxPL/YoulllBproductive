import { create } from 'zustand';
import { completeReminder, snoozeReminder, type SnoozeOption } from '../data/actions';
import { repository } from '../data/repository';
import { categoriesLive, remindersLive } from '../data/store';
import { isNative } from '../lib/platform';
import { isRecurring } from '../lib/recurrence';
import { playAlarm } from '../lib/sound';
import { dayLabel, formatTime } from '../lib/dates';
import { useSettings } from '../state/settings';
import { toast, useUi } from '../state/ui';
import { computeAlarms, type Alarm } from './alarms';
import { useAlarms } from './alarmStore';
import * as native from './native';
import * as web from './web';

export type PermissionView = 'granted' | 'denied' | 'prompt' | 'unsupported';

interface NotifStatus {
  permission: PermissionView;
  exact: boolean;
  refresh: () => Promise<void>;
}

export const useNotifStatus = create<NotifStatus>()((set) => ({
  permission: 'prompt',
  exact: true,
  refresh: async () => {
    if (isNative) {
      const [p, exact] = await Promise.all([native.nativePermission(), native.exactAlarmsGranted()]);
      set({ permission: p, exact });
    } else {
      const p = web.webPermission();
      set({ permission: p === 'default' ? 'prompt' : p, exact: true });
    }
  },
}));

export async function requestNotificationPermission(): Promise<PermissionView> {
  let res: PermissionView;
  if (isNative) {
    res = await native.requestNativePermission();
    if (res === 'granted' && !(await native.exactAlarmsGranted())) await native.openExactAlarmSettings();
  } else {
    const p = await web.requestWebPermission();
    res = p === 'default' ? 'prompt' : p;
  }
  await useNotifStatus.getState().refresh();
  resync();
  return res;
}

export async function openExactAlarmSettings() {
  await native.openExactAlarmSettings();
  await useNotifStatus.getState().refresh();
  resync();
}

// ——— Akcje z powiadomień i z okna alarmu ———

export type AlarmAction = 'done' | 'snooze5' | 'snooze15' | 'snooze60' | 'tomorrow' | 'open';

export async function handleAlarmAction(action: AlarmAction, reminderId: string, occurrence?: string) {
  const r = await repository.reminders.get(reminderId);
  useAlarms.getState().dismiss(`${reminderId}@${occurrence}`);
  if (!r || r.deletedAt) return;
  if (action === 'done') {
    let cur = r;
    if (isRecurring(r) && occurrence) {
      // Zrób wszystkie wystąpienia aż do tego, o którym było powiadomienie
      let guard = 0;
      while (!cur.completedAt && new Date(cur.start) <= new Date(occurrence) && guard++ < 400) cur = await completeReminder(cur);
    } else if (!r.completedAt) await completeReminder(r);
    toast({ message: `Zrobione: ${r.title}`, tone: 'success' });
    return;
  }
  if (action === 'open') {
    useUi.getState().navigate('today');
    return;
  }
  const opt: SnoozeOption = action === 'snooze5' ? 5 : action === 'snooze15' ? 15 : action === 'snooze60' ? 60 : 'tomorrow';
  const target = await snoozeReminder(r, opt);
  toast({ message: `Drzemka do ${dayLabel(target) === 'Dziś' ? '' : `${dayLabel(target).toLowerCase()}, `}${formatTime(target)}` });
}

// ——— Harmonogram ———

let webScheduler: web.WebScheduler | null = null;
let resyncTimer: number | null = null;

function currentAlarms(native: boolean): Alarm[] {
  const s = useSettings.getState();
  const cats = new Map(categoriesLive.current.map((c) => [c.id, c]));
  return computeAlarms(remindersLive.current, cats, {
    from: native ? new Date() : new Date(Date.now() - 5 * 60_000),
    horizonDays: native ? 30 : 2,
    maxTotal: native ? 300 : 500,
    maxPerReminder: native ? 30 : 100,
    allDayTime: s.allDayAlarmTime,
    salt: native ? (s.loudAlarms ? 'L' : 'N') : '',
  });
}

export function resync() {
  if (resyncTimer) window.clearTimeout(resyncTimer);
  resyncTimer = window.setTimeout(() => {
    resyncTimer = null;
    if (isNative) native.syncNative(currentAlarms(true), useSettings.getState().loudAlarms);
    else webScheduler?.setAlarms(currentAlarms(false));
  }, 400);
}

function fireInApp(a: { key: string; reminderId: string; occurrence: string; title: string; at: Date }, withSound: boolean) {
  useAlarms.getState().push({ key: a.key, reminderId: a.reminderId, occurrence: a.occurrence, title: a.title.replace(/^❗ /, ''), at: a.at.toISOString() });
  const s = useSettings.getState();
  if (withSound && s.soundEnabled) playAlarm({ loop: s.loudAlarms, maxMs: s.loudAlarms ? 60_000 : 4_000 });
}

let started = false;

export async function startNotifications() {
  if (started) return;
  started = true;
  remindersLive.subscribe(resync);
  categoriesLive.subscribe(resync);
  useSettings.subscribe((s, prev) => {
    if (s.loudAlarms !== prev.loudAlarms || s.allDayAlarmTime !== prev.allDayAlarmTime) resync();
  });

  if (isNative) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const { App } = await import('@capacitor/app');
    await native.initNativeChannels();
    LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
      const extra = (notification.extra ?? {}) as { reminderId?: string; occurrence?: string; key?: string };
      if (!extra.reminderId) return;
      if (actionId === 'tap') {
        // Dotknięcie powiadomienia – pokaż okno alarmu z opcjami (bez dźwięku)
        fireInApp(
          { key: extra.key ?? `${extra.reminderId}@${extra.occurrence}`, reminderId: extra.reminderId, occurrence: extra.occurrence ?? '', title: notification.title ?? '', at: new Date() },
          false,
        );
        return;
      }
      const map: Record<string, AlarmAction> = { done: 'done', snooze15: 'snooze15', snooze60: 'snooze60' };
      handleAlarmAction(map[actionId] ?? 'open', extra.reminderId, extra.occurrence);
    });
    LocalNotifications.addListener('localNotificationReceived', (n) => {
      const extra = (n.extra ?? {}) as { reminderId?: string; occurrence?: string; key?: string };
      if (!extra.reminderId) return;
      // Aplikacja na wierzchu – system i tak gra dźwięk kanału; pokaż okno alarmu.
      fireInApp({ key: extra.key ?? String(n.id), reminderId: extra.reminderId, occurrence: extra.occurrence ?? '', title: n.title ?? '', at: new Date() }, false);
    });
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        useNotifStatus.getState().refresh();
        resync();
      }
    });
  } else {
    await web.registerServiceWorker();
    webScheduler = new web.WebScheduler((a) => {
      web.showWebNotification(a);
      fireInApp(a, true);
    });
    webScheduler.start();
    navigator.serviceWorker?.addEventListener('message', (e) => {
      const d = e.data as { type?: string; action?: AlarmAction; reminderId?: string; occurrence?: string };
      if (d?.type === 'notification-action' && d.reminderId) {
        if (d.action === 'open') window.focus();
        else handleAlarmAction(d.action ?? 'open', d.reminderId, d.occurrence);
      }
    });
    // Akcja z powiadomienia, które otworzyło nową kartę
    const params = new URLSearchParams(location.search);
    const action = params.get('action') as AlarmAction | null;
    const rid = params.get('r');
    if (action && rid) {
      handleAlarmAction(action, rid, params.get('o') ?? undefined);
      history.replaceState(null, '', location.pathname + location.hash);
    }
  }
  await useNotifStatus.getState().refresh();
  resync();
}

/** Testowe powiadomienie za 5 sekund. */
export async function sendTestNotification() {
  const loud = useSettings.getState().loudAlarms;
  if (isNative) {
    await native.scheduleNativeTest(loud, 5);
    toast({ message: 'Powiadomienie testowe za 5 s – możesz zablokować telefon' });
    return;
  }
  toast({ message: 'Powiadomienie testowe za 5 s' });
  window.setTimeout(() => {
    const a = { key: `test@${Date.now()}`, reminderId: 'test', occurrence: '', title: '🔔 Test powiadomienia', body: 'Tak będą wyglądać Twoje przypomnienia.', at: new Date() };
    web.showWebNotification(a);
    fireInApp(a, true);
  }, 5000);
}
