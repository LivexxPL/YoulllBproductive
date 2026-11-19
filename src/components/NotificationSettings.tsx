import { Bell, BellRing, Play, Send, Smartphone } from 'lucide-react';
import { Card, SettingRow, Toggle } from './ui/Settings';
import { isNative } from '../lib/platform';
import { previewSound } from '../lib/sound';
import {
  openExactAlarmSettings,
  requestNotificationPermission,
  sendTestNotification,
  useNotifStatus,
} from '../notifications/service';
import { useSettings } from '../state/settings';

function StatusPill({ ok, label }: { ok: boolean | 'warn'; label: string }) {
  const cls =
    ok === true ? 'bg-[color-mix(in_oklab,var(--success)_15%,transparent)] text-success' : ok === 'warn' ? 'bg-[color-mix(in_oklab,var(--warn)_18%,transparent)] text-warn' : 'bg-danger-soft text-danger';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{label}</span>;
}

export function NotificationSettings() {
  const { permission, exact } = useNotifStatus();
  const loud = useSettings((s) => s.loudAlarms);
  const sound = useSettings((s) => s.soundEnabled);
  const set = useSettings((s) => s.set);

  const permLabel =
    permission === 'granted' ? 'Włączone' : permission === 'denied' ? 'Zablokowane' : permission === 'unsupported' ? 'Brak obsługi' : 'Wyłączone';

  return (
    <Card
      title="Powiadomienia"
      icon={<Bell size={15} />}
      description={
        isNative ? (
          <>
            Powiadomienia przychodzą o dokładnej godzinie, także przy zamkniętej aplikacji i po restarcie telefonu. Na niektórych
            telefonach (Xiaomi, Huawei, Samsung) wyłącz dla aplikacji <b>optymalizację baterii</b>, żeby system jej nie usypiał.
          </>
        ) : (
          <>
            <b>W przeglądarce powiadomienia działają tylko wtedy, gdy karta z aplikacją jest otwarta</b> (może być w tle). To
            ograniczenie przeglądarek. Aby przypomnienia działały zawsze, zainstaluj aplikację na Androida.
          </>
        )
      }
    >
      <SettingRow label="Zgoda na powiadomienia" hint={isNative ? 'Android 13+: uprawnienie POST_NOTIFICATIONS' : 'Notification API przeglądarki'}>
        <div className="flex items-center gap-2">
          <StatusPill ok={permission === 'granted'} label={permLabel} />
          {permission !== 'granted' && permission !== 'unsupported' && (
            <button className="btn btn-primary h-9 px-3.5 text-sm" onClick={() => requestNotificationPermission()}>
              Włącz
            </button>
          )}
        </div>
      </SettingRow>

      {isNative && (
        <SettingRow label="Dokładne alarmy" hint="Android 12+: „Alarmy i przypomnienia” – przypomnienie co do minuty">
          <div className="flex items-center gap-2">
            <StatusPill ok={exact ? true : 'warn'} label={exact ? 'Dozwolone' : 'Niedozwolone'} />
            {!exact && (
              <button className="btn btn-primary h-9 px-3.5 text-sm" onClick={() => openExactAlarmSettings()}>
                Zezwól
              </button>
            )}
          </div>
        </SettingRow>
      )}

      <SettingRow
        label={
          <span className="inline-flex items-center gap-2">
            <BellRing size={16} className="text-accent" /> Głośny alarm
          </span>
        }
        hint={
          isNative
            ? 'Dźwięk alarmu w strumieniu budzika – słychać go nawet w trybie cichym. Wyłącz, by używać zwykłego dźwięku powiadomień.'
            : 'Dźwięk w pętli (do 1 min) i okno alarmu na pełnym ekranie, dopóki nie zareagujesz.'
        }
      >
        <Toggle checked={loud} onChange={(v) => set({ loudAlarms: v })} label="Głośny alarm" />
      </SettingRow>

      {!isNative && (
        <SettingRow label="Dźwięk w aplikacji" hint="Odtwarzany przy alarmie, gdy karta jest otwarta">
          <div className="flex items-center gap-2">
            <button className="icon-btn h-9 w-9" onClick={previewSound} aria-label="Odsłuchaj">
              <Play size={16} />
            </button>
            <Toggle checked={sound} onChange={(v) => set({ soundEnabled: v })} label="Dźwięk w aplikacji" />
          </div>
        </SettingRow>
      )}

      <SettingRow label="Wyślij testowe powiadomienie" hint={isNative ? 'Za 5 sekund – zablokuj telefon, żeby sprawdzić' : 'Za 5 sekund'}>
        <button className="btn btn-ghost h-10 text-sm" onClick={() => sendTestNotification()}>
          <Send size={15} /> Test
        </button>
      </SettingRow>

      {!isNative && (
        <div className="flex items-start gap-3 bg-accent-soft/60 px-4 py-3 text-[0.8125rem] text-ink-2">
          <Smartphone size={18} className="mt-0.5 shrink-0 text-accent" />
          <span>
            Na komputerze możesz też „zainstalować” stronę jako aplikację (ikona w pasku adresu Chrome/Edge) – wtedy łatwiej trzymać ją otwartą.
          </span>
        </div>
      )}
    </Card>
  );
}
