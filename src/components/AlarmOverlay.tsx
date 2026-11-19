import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { AlarmClock, BellRing, Check, X } from 'lucide-react';
import { useAlarms } from '../notifications/alarmStore';
import { handleAlarmAction, type AlarmAction } from '../notifications/service';
import { findReminder } from '../data/actions';
import { useCategoryMap } from '../data/store';
import { colorHex } from '../lib/colors';
import { dayLabel, formatTime } from '../lib/dates';
import { useBackHandler } from '../lib/hooks';
import { stopAlarm } from '../lib/sound';

const SNOOZES: Array<{ action: AlarmAction; label: string }> = [
  { action: 'snooze5', label: '5 min' },
  { action: 'snooze15', label: '15 min' },
  { action: 'snooze60', label: '1 godz.' },
  { action: 'tomorrow', label: 'Jutro' },
];

/** Pełnoekranowy alarm w aplikacji – z dzwoniącym dzwonkiem i dużymi przyciskami. */
export function AlarmOverlay() {
  const queue = useAlarms((s) => s.queue);
  const dismiss = useAlarms((s) => s.dismiss);
  const cats = useCategoryMap();
  const a = queue[0];
  const r = a ? findReminder(a.reminderId) : undefined;
  const cat = r?.categoryId ? cats.get(r.categoryId) : undefined;
  const color = colorHex(cat?.color);
  useBackHandler(!!a, () => a && dismiss(a.key));

  const act = (action: AlarmAction) => {
    if (!a) return;
    stopAlarm();
    if (a.reminderId === 'test') return dismiss(a.key);
    handleAlarmAction(action, a.reminderId, a.occurrence);
  };

  const at = a ? new Date(r?.start ?? a.at) : null;

  return createPortal(
    <AnimatePresence>
      {a && (
        <motion.div
          key="alarm"
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-label={`Przypomnienie: ${a.title}`}
        >
          <div className="absolute inset-0 bg-[rgb(10_12_24/0.6)] backdrop-blur-md" onClick={() => stopAlarm()} />
          <motion.div
            key={a.key}
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="relative m-3 w-full max-w-md overflow-hidden rounded-[2rem] bg-surface pb-safe shadow-[var(--shadow-pop)]"
          >
            <div className="relative overflow-hidden px-6 pb-6 pt-8 text-center text-white" style={{ background: `linear-gradient(150deg, ${color}, #4f6bf5 70%, #7a4fe0)` }}>
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/10" />
              <button className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/15" onClick={() => dismiss(a.key)} aria-label="Zamknij">
                <X size={18} />
              </button>
              <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/20">
                <span className="pulse-ring absolute inset-0 rounded-full text-white/40" />
                <BellRing size={38} className="animate-ring relative" />
              </div>
              <div className="relative mt-4 text-sm font-semibold uppercase tracking-[0.12em] opacity-85">
                {at ? `${dayLabel(at)}${r?.allDay ? '' : ` · ${formatTime(at)}`}` : 'Przypomnienie'}
              </div>
              <div className="relative mt-1 font-display text-[1.75rem] font-bold leading-tight">{a.title}</div>
              {cat && <div className="relative mt-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{cat.name}</div>}
              {r?.notes && <p className="relative mx-auto mt-3 line-clamp-3 max-w-xs text-sm opacity-90">{r.notes}</p>}
            </div>
            <div className="space-y-3 p-5">
              <button className="btn btn-primary h-14 w-full rounded-2xl bg-success text-base text-white shadow-[0_10px_24px_-10px_rgb(18_163_122/0.8)]" onClick={() => act('done')}>
                <Check size={22} strokeWidth={2.6} /> Zrobione
              </button>
              <div>
                <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-faint">
                  <AlarmClock size={13} /> Drzemka
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {SNOOZES.map((s) => (
                    <button key={s.action} className="btn btn-ghost h-12 rounded-2xl px-0 text-sm" onClick={() => act(s.action)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {queue.length > 1 && <div className="text-center text-xs font-medium text-muted">Jeszcze {queue.length - 1} w kolejce</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
