/**
 * Natywne powiadomienia Androida (@capacitor/local-notifications).
 *
 * - dokładny czas (AlarmManager.setExactAndAllowWhileIdle) także przy zamkniętej aplikacji,
 * - kanał „alarmy” tworzony natywnie w MainActivity z dźwiękiem alarmu (USAGE_ALARM),
 *   więc dzwoni głośno nawet w trybie cichym,
 * - przyciski „Zrobione” i „Drzemka” bezpośrednio w powiadomieniu,
 * - po restarcie telefonu wtyczka sama przywraca zaplanowane powiadomienia.
 */
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import type { Alarm } from './alarms';

export const CHANNEL_LOUD = 'ybp_alarmy_v1';
export const CHANNEL_NORMAL = 'ybp_przypomnienia_v1';
export const ACTION_TYPE = 'YBP_REMINDER';

export type NativePermission = 'granted' | 'denied' | 'prompt';

export async function nativePermission(): Promise<NativePermission> {
  const p = await LocalNotifications.checkPermissions();
  return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
}

export async function requestNativePermission(): Promise<NativePermission> {
  const p = await LocalNotifications.requestPermissions();
  return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
}

export async function exactAlarmsGranted(): Promise<boolean> {
  try {
    const r = await LocalNotifications.checkExactNotificationSetting();
    return r.exact_alarm === 'granted';
  } catch {
    return true; // Android < 12 albo brak API
  }
}

export async function openExactAlarmSettings(): Promise<boolean> {
  try {
    const r = await LocalNotifications.changeExactNotificationSetting();
    return r.exact_alarm === 'granted';
  } catch {
    return false;
  }
}

export async function initNativeChannels() {
  // Kanały tworzy też MainActivity (z dźwiękiem w strumieniu alarmu) – to tylko zabezpieczenie.
  await LocalNotifications.createChannel({
    id: CHANNEL_LOUD,
    name: 'Alarmy (głośne)',
    description: 'Głośne przypomnienia – dźwięk alarmu, także w trybie cichym',
    importance: 5,
    visibility: 1,
    sound: 'alarm.wav',
    vibration: true,
    lights: true,
    lightColor: '#4F6BF5',
  }).catch(() => {});
  await LocalNotifications.createChannel({
    id: CHANNEL_NORMAL,
    name: 'Przypomnienia',
    description: 'Zwykłe powiadomienia z domyślnym dźwiękiem',
    importance: 4,
    visibility: 1,
    vibration: true,
  }).catch(() => {});
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTION_TYPE,
        actions: [
          { id: 'done', title: 'Zrobione' },
          { id: 'snooze15', title: 'Drzemka 15 min' },
          { id: 'snooze60', title: '1 godz.' },
        ],
      },
    ],
  }).catch(() => {});
}

let syncing: Promise<void> | null = null;
let queued: { alarms: Alarm[]; loud: boolean } | null = null;

/** Zsynchronizuj zaplanowane powiadomienia z listą alarmów (różnicowo po ID). */
export function syncNative(alarms: Alarm[], loud: boolean): Promise<void> {
  queued = { alarms, loud };
  if (syncing) return syncing;
  syncing = (async () => {
    while (queued) {
      const job = queued;
      queued = null;
      try {
        await doSync(job.alarms, job.loud);
      } catch (e) {
        console.warn('[native] sync failed', e);
      }
    }
    syncing = null;
  })();
  return syncing;
}

async function doSync(alarms: Alarm[], loud: boolean) {
  if ((await nativePermission()) !== 'granted') return;
  const exact = await exactAlarmsGranted();
  const pending = await LocalNotifications.getPending();
  const desired = new Map(alarms.map((a) => [a.id, a]));
  const pendingIds = new Set(pending.notifications.map((n) => n.id));

  const toCancel = pending.notifications.filter((n) => !desired.has(n.id)).map((n) => ({ id: n.id }));
  if (toCancel.length) await LocalNotifications.cancel({ notifications: toCancel });

  const toSchedule: LocalNotificationSchema[] = alarms
    .filter((a) => !pendingIds.has(a.id) && a.at.getTime() > Date.now() + 1000)
    .map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body.split('\n')[0],
      largeBody: a.body,
      schedule: { at: a.at, allowWhileIdle: true },
      channelId: loud ? CHANNEL_LOUD : CHANNEL_NORMAL,
      sound: loud ? 'alarm.wav' : undefined,
      actionTypeId: ACTION_TYPE,
      smallIcon: 'ic_stat_notify',
      iconColor: '#4F6BF5',
      autoCancel: true,
      group: 'ybp',
      // Bez uprawnienia nie otwieraj ekranu ustawień przy każdej synchronizacji –
      // baner w aplikacji poprosi o nie świadomie.
      isExactNotification: exact,
      extra: { reminderId: a.reminderId, occurrence: a.occurrence, key: a.key },
    }));
  // Paczkami, żeby nie przekroczyć limitów mostka
  for (let i = 0; i < toSchedule.length; i += 50) {
    await LocalNotifications.schedule({ notifications: toSchedule.slice(i, i + 50) });
  }
}

export async function scheduleNativeTest(loud: boolean, inSeconds = 5) {
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 999_999_001,
        title: '🔔 Test powiadomienia',
        body: 'Tak będą wyglądać Twoje przypomnienia.',
        schedule: { at: new Date(Date.now() + inSeconds * 1000), allowWhileIdle: true },
        channelId: loud ? CHANNEL_LOUD : CHANNEL_NORMAL,
        sound: loud ? 'alarm.wav' : undefined,
        smallIcon: 'ic_stat_notify',
        iconColor: '#4F6BF5',
        isExactNotification: await exactAlarmsGranted(),
        extra: { test: true },
      },
    ],
  });
}
