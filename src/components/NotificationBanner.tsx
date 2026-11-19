import { motion } from 'motion/react';
import { BellOff, BellRing, Info, X } from 'lucide-react';
import { isNative } from '../lib/platform';
import { openExactAlarmSettings, requestNotificationPermission, useNotifStatus } from '../notifications/service';
import { useSettings } from '../state/settings';

/** Baner na ekranie „Dziś” – prosi o zgodę na powiadomienia i wyjaśnia ograniczenia przeglądarki. */
export function NotificationBanner() {
  const { permission, exact } = useNotifStatus();
  const dismissed = useSettings((s) => s.webNoticeDismissed);
  const set = useSettings((s) => s.set);

  if (isNative) {
    if (permission !== 'granted') {
      return (
        <Banner
          icon={<BellRing size={20} />}
          title="Włącz powiadomienia"
          text="Przypomnienia zadzwonią o czasie – także gdy aplikacja jest zamknięta."
          action={permission === 'denied' ? 'Otwórz ustawienia' : 'Włącz'}
          onAction={() => requestNotificationPermission()}
        />
      );
    }
    if (!exact) {
      return (
        <Banner
          icon={<BellRing size={20} />}
          title="Zezwól na dokładne alarmy"
          text="Bez tego Android może opóźnić przypomnienie o kilka minut."
          action="Zezwól"
          onAction={() => openExactAlarmSettings()}
        />
      );
    }
    return null;
  }

  if (permission === 'unsupported' || dismissed) return null;
  if (permission === 'prompt') {
    return (
      <Banner
        icon={<BellRing size={20} />}
        title="Włącz powiadomienia w przeglądarce"
        text="Działają, gdy ta karta jest otwarta (może być w tle). Przy zamkniętej karcie użyj aplikacji na Androida."
        action="Włącz"
        onAction={() => requestNotificationPermission()}
        onClose={() => set({ webNoticeDismissed: true })}
      />
    );
  }
  if (permission === 'denied') {
    return (
      <Banner
        icon={<BellOff size={20} />}
        tone="muted"
        title="Powiadomienia są zablokowane"
        text="Odblokuj je w ustawieniach strony (ikona kłódki obok adresu). Alarm w aplikacji nadal zadziała przy otwartej karcie."
        onClose={() => set({ webNoticeDismissed: true })}
      />
    );
  }
  return (
    <Banner
      icon={<Info size={20} />}
      tone="muted"
      title="Powiadomienia włączone"
      text="Pamiętaj: w przeglądarce działają tylko przy otwartej karcie. Aplikacja na Androida dzwoni zawsze."
      onClose={() => set({ webNoticeDismissed: true })}
    />
  );
}

function Banner({
  icon,
  title,
  text,
  action,
  onAction,
  onClose,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
  onClose?: () => void;
  tone?: 'muted';
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card flex items-start gap-3 p-4 ${tone === 'muted' ? '' : 'ring-1 ring-accent/20'}`}
    >
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tone === 'muted' ? 'bg-surface-2 text-muted' : 'bg-accent-soft text-accent'}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[0.9375rem] font-semibold">{title}</div>
        <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted">{text}</p>
        {action && (
          <button className="btn btn-primary mt-3 h-9 px-4 text-sm" onClick={onAction}>
            {action}
          </button>
        )}
      </div>
      {onClose && (
        <button className="icon-btn -mr-1 -mt-1 h-8 w-8 text-faint" onClick={onClose} aria-label="Ukryj">
          <X size={16} />
        </button>
      )}
    </motion.div>
  );
}
