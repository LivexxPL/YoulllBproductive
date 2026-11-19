import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarDays, Clock, CornerDownLeft, Flag, Repeat, SlidersHorizontal, Sparkles, Tag, Timer } from 'lucide-react';
import { startOfDay } from 'date-fns';
import { Sheet } from './ui/Sheet';
import { createCategory, createReminder } from '../data/actions';
import { useCategories } from '../data/store';
import { colorHex, PRIORITY_META } from '../lib/colors';
import { dayLabel, durationLabel, formatTime } from '../lib/dates';
import { describeRecurrence } from '../lib/recurrence';
import { parseQuickAdd } from '../lib/quickParse';
import { haptic } from '../lib/platform';
import { NO_REPEAT, type ReminderDraft } from '../lib/types';
import { useSettings } from '../state/settings';
import { toast, useUi } from '../state/ui';

const SUGGESTIONS = ['dziś', 'jutro', 'o 9:00', 'wieczorem', 'w poniedziałek', 'co tydzień', 'przez 1h', '!'];

export function QuickAdd() {
  const open = useUi((s) => s.quickAddOpen);
  const seed = useUi((s) => s.quickAddSeed);
  const setOpen = useUi((s) => s.setQuickAdd);
  return (
    <Sheet open={open} onClose={() => setOpen(false)} placement="top" width="38rem" label="Szybkie dodawanie" hideClose>
      <QuickAddBody key={open ? `open-${seed}` : 'closed'} seed={seed} />
    </Sheet>
  );
}

function QuickAddBody({ seed }: { seed: string }) {
  const [text, setText] = useState(seed);
  const [now] = useState(() => new Date());
  const inputRef = useRef<HTMLInputElement>(null);
  const categories = useCategories();
  const defaultDuration = useSettings((s) => s.defaultDurationMin);
  const setOpen = useUi((s) => s.setQuickAdd);
  const openEditor = useUi((s) => s.openEditor);
  const focusCategory = useUi((s) => s.focusCategory);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const parsed = useMemo(() => parseQuickAdd(text, new Date(), categories), [text, categories]);
  const category = categories.find((c) => c.id === (parsed.categoryId ?? focusCategory));

  const toDraft = async (): Promise<ReminderDraft> => {
    let categoryId = parsed.categoryId ?? (focusCategory && categories.some((c) => c.id === focusCategory) ? focusCategory : null);
    if (parsed.newCategoryName) categoryId = (await createCategory(parsed.newCategoryName)).id;
    const date = parsed.date ?? startOfDay(new Date());
    const allDay = parsed.date ? parsed.allDay : true;
    return {
      title: parsed.title || text.trim(),
      notes: '',
      start: (allDay ? startOfDay(date) : date).toISOString(),
      allDay,
      durationMin: allDay ? 0 : parsed.durationMin ?? defaultDuration,
      priority: parsed.priority ?? 'medium',
      categoryId,
      recurrence: parsed.recurrence ?? NO_REPEAT,
    };
  };

  const submit = async () => {
    if (!text.trim()) return;
    const draft = await toDraft();
    const r = await createReminder(draft);
    haptic('light');
    setOpen(false);
    const d = new Date(r.start);
    toast({
      message: `Dodano · ${dayLabel(d)}${r.allDay ? '' : `, ${formatTime(d)}`}`,
      tone: 'success',
      actionLabel: 'Edytuj',
      onAction: () => openEditor({ reminderId: r.id }),
    });
  };

  const details = async () => {
    const draft = await toDraft();
    openEditor({ draft });
  };

  const append = (s: string) => {
    setText((t) => (t.trim() ? `${t.trim()} ${s}` : `${s} `));
    inputRef.current?.focus();
  };

  const chips: Array<{ key: string; icon: ReactNode; label: string; color?: string }> = [];
  if (parsed.date) {
    chips.push({ key: 'date', icon: <CalendarDays size={14} />, label: dayLabel(parsed.date, now) });
    if (!parsed.allDay) chips.push({ key: 'time', icon: <Clock size={14} />, label: formatTime(parsed.date) });
  } else if (text.trim()) {
    chips.push({ key: 'date', icon: <CalendarDays size={14} />, label: 'Dziś · bez godziny' });
  }
  if (parsed.durationMin) chips.push({ key: 'dur', icon: <Timer size={14} />, label: durationLabel(parsed.durationMin) });
  if (parsed.recurrence) {
    chips.push({ key: 'rep', icon: <Repeat size={14} />, label: describeRecurrence(parsed.recurrence, parsed.date ?? now) });
  }
  if (parsed.priority) {
    chips.push({ key: 'prio', icon: <Flag size={14} />, label: `Priorytet: ${PRIORITY_META[parsed.priority].label.toLowerCase()}`, color: PRIORITY_META[parsed.priority].hex });
  }
  if (category) chips.push({ key: 'cat', icon: <Tag size={14} />, label: category.name, color: colorHex(category.color) });
  else if (parsed.newCategoryName) chips.push({ key: 'cat', icon: <Tag size={14} />, label: `Nowa: ${parsed.newCategoryName}` });

  return (
    <div className="pt-4">
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 ring-accent/0 transition-shadow focus-within:bg-surface focus-within:shadow-[0_0_0_1.5px_var(--accent),0_0_0_6px_var(--accent-soft)]">
        <Sparkles size={20} className="shrink-0 text-accent" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          enterKeyHint="done"
          autoComplete="off"
          placeholder="np. jutro 15:00 telefon do klienta"
          className="h-14 min-w-0 flex-1 bg-transparent text-[1.0625rem] font-medium outline-none placeholder:font-normal placeholder:text-faint"
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-white transition-all disabled:opacity-30 dark:text-[#0b0d12]"
          aria-label="Dodaj"
        >
          <CornerDownLeft size={18} />
        </button>
      </div>

      <div className="mt-3 min-h-[4.25rem]">
        {text.trim() ? (
          <>
            <div className="px-1 text-[0.8125rem] text-muted">
              <span className="font-semibold text-ink">{parsed.title || '…'}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {chips.map((c) => (
                  <motion.span
                    key={`${c.key}-${c.label}`}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 420 }}
                    className="chip h-7 bg-accent-soft px-2.5 text-[0.78rem] text-accent"
                    style={c.color ? { background: `${c.color}1f`, color: c.color } : undefined}
                  >
                    {c.icon}
                    {c.label}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div>
            <div className="px-1 text-[0.8125rem] text-muted">
              Wpisz po prostu, a ja rozpoznam datę, godzinę, powtarzanie, <b className="font-semibold">#kategorię</b> i <b className="font-semibold">!</b> priorytet.
            </div>
          </div>
        )}
      </div>

      <div className="scrollbar-none -mx-5 mt-1 flex gap-1.5 overflow-x-auto px-5 pb-1">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip h-8 shrink-0 text-[0.8125rem]" onClick={() => append(s)}>
            {s}
          </button>
        ))}
        {categories.slice(0, 4).map((c) => (
          <button key={c.id} className="chip h-8 shrink-0 text-[0.8125rem]" onClick={() => append(`#${c.name.toLowerCase()}`)}>
            <span className="dot" style={{ ['--c' as string]: colorHex(c.color) }} />#{c.name.toLowerCase()}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
        <button className="btn btn-ghost h-10 px-3.5 text-sm" onClick={details}>
          <SlidersHorizontal size={16} /> Szczegóły
        </button>
        <div className="flex-1" />
        <span className="hidden text-xs text-faint sm:block">Enter – dodaj · Esc – zamknij</span>
        <button className="btn btn-primary h-10 px-5 text-sm" onClick={submit} disabled={!text.trim()}>
          Dodaj
        </button>
      </div>
    </div>
  );
}
