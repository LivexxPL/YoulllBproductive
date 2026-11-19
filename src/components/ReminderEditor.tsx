import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { format, startOfDay } from 'date-fns';
import {
  AlarmClock,
  CalendarDays,
  Check,
  Clock,
  Flag,
  Plus,
  Repeat,
  Tag,
  Timer,
  Trash,
  Undo2,
} from 'lucide-react';
import { Sheet } from './ui/Sheet';
import { deleteWithToast, toggleDone } from './reminderUi';
import { createCategory, createReminder, findReminder, updateReminder } from '../data/actions';
import { useCategories } from '../data/store';
import { CATEGORY_COLORS, PRIORITY_META } from '../lib/colors';
import { capitalize, durationLabel, fmt, nextRoundHour, orderedWeekdays, WEEKDAY_SHORT } from '../lib/dates';
import { alignToRule, describeRecurrence, makeRecurrence } from '../lib/recurrence';
import { NO_REPEAT, type Priority, type Recurrence, type RepeatFreq, type RepeatUnit } from '../lib/types';
import { useSettings } from '../state/settings';
import { toast, useUi } from '../state/ui';

interface FormState {
  title: string;
  notes: string;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  allDay: boolean;
  durationMin: number;
  priority: Priority;
  categoryId: string | null;
  recurrence: Recurrence;
}

const DURATIONS = [0, 15, 30, 60, 90, 120];
const FREQS: Array<{ value: RepeatFreq; label: string }> = [
  { value: 'none', label: 'Nie' },
  { value: 'daily', label: 'Codziennie' },
  { value: 'weekdays', label: 'Dni robocze' },
  { value: 'weekly', label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
  { value: 'custom', label: 'Własne…' },
];
const UNITS: Array<{ value: RepeatUnit; label: string }> = [
  { value: 'day', label: 'dni' },
  { value: 'week', label: 'tyg.' },
  { value: 'month', label: 'mies.' },
  { value: 'year', label: 'lat' },
];

function initialState(reminderId: string | null, draft: ReturnType<typeof useUi.getState>['editor']['draft'], defaultDuration: number): FormState {
  const r = reminderId ? findReminder(reminderId) : undefined;
  const src = r ?? draft ?? {};
  const start = src.start ? new Date(src.start) : nextRoundHour();
  return {
    title: src.title ?? '',
    notes: src.notes ?? '',
    date: format(start, 'yyyy-MM-dd'),
    time: src.allDay ? format(nextRoundHour(), 'HH:mm') : format(start, 'HH:mm'),
    allDay: src.allDay ?? false,
    durationMin: src.durationMin ?? defaultDuration,
    priority: src.priority ?? 'medium',
    categoryId: src.categoryId ?? null,
    recurrence: src.recurrence ?? NO_REPEAT,
  };
}

export function ReminderEditor() {
  const editor = useUi((s) => s.editor);
  const close = useUi((s) => s.closeEditor);
  const [session, setSession] = useState(0);
  useEffect(() => {
    if (editor.open) setSession((s) => s + 1);
  }, [editor.open, editor.reminderId, editor.draft]);

  return (
    <Sheet open={editor.open} onClose={close} label="Edycja przypomnienia" hideClose title={null} width="36rem">
      <EditorBody key={session} />
    </Sheet>
  );
}

function EditorBody() {
  const editor = useUi((s) => s.editor);
  const close = useUi((s) => s.closeEditor);
  const defaultDuration = useSettings((s) => s.defaultDurationMin);
  const weekStartsOn = useSettings((s) => s.weekStartsOn);
  const categories = useCategories();
  const existing = editor.reminderId ? findReminder(editor.reminderId) : undefined;
  const [f, setF] = useState<FormState>(() => initialState(editor.reminderId, editor.draft, defaultDuration));
  const [newCat, setNewCat] = useState<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const isNew = !existing;
  const set = (patch: Partial<FormState>) => setF((s) => ({ ...s, ...patch }));

  useEffect(() => {
    if (isNew) setTimeout(() => titleRef.current?.focus(), 250);
  }, [isNew]);

  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [f.title]);

  const startDate = useMemo(() => {
    const [y, m, d] = f.date.split('-').map(Number);
    const [hh, mm] = f.time.split(':').map(Number);
    return f.allDay ? new Date(y, m - 1, d) : new Date(y, m - 1, d, hh || 0, mm || 0);
  }, [f.date, f.time, f.allDay]);

  const setFreq = (freq: RepeatFreq) => {
    if (freq === 'none') return set({ recurrence: NO_REPEAT });
    const base = makeRecurrence(freq, startDate, freq === 'custom' ? { unit: 'week', interval: 2, weekdays: [startDate.getDay()] } : undefined);
    set({ recurrence: { ...base, until: f.recurrence.until } });
  };

  const save = async () => {
    let start = startDate;
    // Pierwsze wystąpienie wyrównane do reguły (np. „dni robocze” w sobotę → poniedziałek)
    if (f.recurrence.freq !== 'none') start = alignToRule(f.recurrence, start);
    const rec: Recurrence =
      f.recurrence.freq === 'monthly' || (f.recurrence.freq === 'custom' && f.recurrence.unit === 'month')
        ? { ...f.recurrence, monthDay: start.getDate() }
        : f.recurrence;
    const payload = {
      title: f.title.trim() || 'Bez tytułu',
      notes: f.notes.trim(),
      start: (f.allDay ? startOfDay(start) : start).toISOString(),
      allDay: f.allDay,
      durationMin: f.allDay ? 0 : f.durationMin,
      priority: f.priority,
      categoryId: f.categoryId,
      recurrence: rec,
    };
    if (existing) {
      const timeChanged = payload.start !== existing.start;
      await updateReminder(existing.id, { ...payload, ...(timeChanged ? { snoozedUntil: null } : {}) });
      toast({ message: 'Zapisano zmiany', tone: 'success' });
    } else {
      await createReminder(payload);
      toast({ message: 'Dodano przypomnienie', tone: 'success' });
    }
    close();
  };

  const addCategory = async () => {
    if (!newCat?.trim()) return setNewCat(null);
    const c = await createCategory(newCat);
    set({ categoryId: c.id });
    setNewCat(null);
  };

  const weekdays = orderedWeekdays(weekStartsOn);
  const showWeekdays = f.recurrence.freq === 'weekly' || (f.recurrence.freq === 'custom' && f.recurrence.unit === 'week');
  const toggleWeekday = (d: number) => {
    const cur = f.recurrence.weekdays.length ? f.recurrence.weekdays : [startDate.getDay()];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    if (!next.length) return;
    set({ recurrence: { ...f.recurrence, weekdays: next } });
  };

  return (
    <div className="pb-2 pt-1">
      {/* Nagłówek */}
      <div className="flex items-center gap-2 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-faint">
          {isNew ? 'Nowe przypomnienie' : 'Edycja'}
        </span>
        <div className="flex-1" />
        {existing && (
          <button
            className={`chip ${existing.completedAt ? '' : 'text-success'}`}
            onClick={async () => {
              await toggleDone(existing);
              close();
            }}
          >
            {existing.completedAt ? <Undo2 size={15} /> : <Check size={15} />}
            {existing.completedAt ? 'Przywróć' : 'Zrobione'}
          </button>
        )}
      </div>

      <textarea
        ref={titleRef}
        rows={1}
        value={f.title}
        onChange={(e) => set({ title: e.target.value.replace(/\n/g, ' ') })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          }
        }}
        placeholder="Co trzeba zrobić?"
        className="w-full resize-none bg-transparent font-display text-[1.5rem] font-semibold leading-tight outline-none placeholder:text-faint"
      />
      <textarea
        value={f.notes}
        onChange={(e) => set({ notes: e.target.value })}
        placeholder="Notatka"
        rows={f.notes ? Math.min(6, f.notes.split('\n').length + 1) : 1}
        className="mt-1 w-full resize-none bg-transparent text-[0.9375rem] leading-relaxed text-ink-2 outline-none placeholder:text-faint"
      />

      <div className="mt-3 space-y-4">
        {/* Kiedy */}
        <Row icon={<CalendarDays size={18} />} label="Kiedy">
          <div className="flex flex-wrap items-center gap-2">
            <PickerChip
              type="date"
              value={f.date}
              onChange={(v) => v && set({ date: v })}
              label={capitalize(fmt(startDate, 'EEE, d MMM yyyy'))}
            />
            {!f.allDay && (
              <PickerChip type="time" value={f.time} onChange={(v) => v && set({ time: v })} label={f.time} icon={<Clock size={15} />} />
            )}
            <button className="chip" data-active={f.allDay} onClick={() => set({ allDay: !f.allDay })}>
              Cały dzień
            </button>
          </div>
        </Row>

        {!f.allDay && (
          <Row icon={<Timer size={18} />} label="Czas trwania">
            <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
              {DURATIONS.map((d) => (
                <button key={d} className="chip" data-active={f.durationMin === d} onClick={() => set({ durationMin: d })}>
                  {d === 0 ? 'Brak' : durationLabel(d)}
                </button>
              ))}
              {!DURATIONS.includes(f.durationMin) && (
                <span className="chip" data-active>
                  {durationLabel(f.durationMin)}
                </span>
              )}
            </div>
          </Row>
        )}

        {/* Priorytet */}
        <Row icon={<Flag size={18} />} label="Priorytet">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
            {(['low', 'medium', 'high'] as Priority[]).map((p) => {
              const active = f.priority === p;
              return (
                <button
                  key={p}
                  onClick={() => set({ priority: p })}
                  className={`flex h-9 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-all ${
                    active ? 'bg-surface text-ink shadow-[var(--shadow-card)]' : 'text-muted'
                  }`}
                >
                  <Flag size={14} style={{ color: PRIORITY_META[p].hex }} fill={active ? PRIORITY_META[p].hex : 'none'} />
                  {PRIORITY_META[p].label}
                </button>
              );
            })}
          </div>
        </Row>

        {/* Kategoria */}
        <Row icon={<Tag size={18} />} label="Kategoria">
          <div className="flex flex-wrap gap-1.5">
            <button className="chip" data-active={f.categoryId === null} onClick={() => set({ categoryId: null })}>
              Brak
            </button>
            {categories.map((c) => {
              const active = f.categoryId === c.id;
              const hex = CATEGORY_COLORS[c.color].hex;
              return (
                <button
                  key={c.id}
                  className="chip"
                  onClick={() => set({ categoryId: c.id })}
                  style={active ? { background: hex, color: '#fff' } : undefined}
                >
                  <span className="dot" style={{ ['--c' as string]: active ? '#fff' : hex }} />
                  {c.name}
                </button>
              );
            })}
            {newCat === null ? (
              <button className="chip text-accent" onClick={() => setNewCat('')}>
                <Plus size={15} /> Nowa
              </button>
            ) : (
              <input
                autoFocus
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onBlur={addCategory}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCategory();
                }}
                placeholder="Nazwa kategorii"
                className="chip w-40 outline-none ring-1 ring-accent"
              />
            )}
          </div>
        </Row>

        {/* Powtarzanie */}
        <Row icon={<Repeat size={18} />} label="Powtarzanie">
          <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {FREQS.map((o) => (
              <button key={o.value} className="chip" data-active={f.recurrence.freq === o.value} onClick={() => setFreq(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          {f.recurrence.freq === 'custom' && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Co</span>
              <input
                type="number"
                min={1}
                max={99}
                value={f.recurrence.interval}
                onChange={(e) => set({ recurrence: { ...f.recurrence, interval: Math.max(1, Number(e.target.value) || 1) } })}
                className="field tnum h-9 w-16 py-0 text-center"
              />
              <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
                {UNITS.map((u) => (
                  <button
                    key={u.value}
                    onClick={() =>
                      set({
                        recurrence: {
                          ...f.recurrence,
                          unit: u.value,
                          weekdays: u.value === 'week' ? f.recurrence.weekdays.length ? f.recurrence.weekdays : [startDate.getDay()] : [],
                          monthDay: u.value === 'month' ? startDate.getDate() : null,
                        },
                      })
                    }
                    className={`h-7 rounded-lg px-2.5 text-[0.8125rem] font-semibold ${
                      f.recurrence.unit === u.value ? 'bg-surface text-ink shadow-sm' : 'text-muted'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {showWeekdays && (
            <div className="mt-2.5 flex gap-1.5">
              {weekdays.map((d) => {
                const active = (f.recurrence.weekdays.length ? f.recurrence.weekdays : [startDate.getDay()]).includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggleWeekday(d)}
                    className={`grid h-9 w-9 place-items-center rounded-full text-[0.8125rem] font-semibold uppercase transition-all ${
                      active ? 'bg-accent text-white dark:text-[#0b0d12]' : 'bg-surface-2 text-muted'
                    }`}
                  >
                    {WEEKDAY_SHORT[d]}
                  </button>
                );
              })}
            </div>
          )}
          {f.recurrence.freq !== 'none' && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted">
              <span className="font-medium text-ink-2">{describeRecurrence(f.recurrence, startDate)}</span>
              <span>·</span>
              <span>Koniec:</span>
              {f.recurrence.until ? (
                <>
                  <PickerChip
                    type="date"
                    value={f.recurrence.until}
                    onChange={(v) => set({ recurrence: { ...f.recurrence, until: v || null } })}
                    label={fmt(new Date(f.recurrence.until), 'd MMM yyyy')}
                    small
                  />
                  <button className="text-accent" onClick={() => set({ recurrence: { ...f.recurrence, until: null } })}>
                    bez końca
                  </button>
                </>
              ) : (
                <button
                  className="font-medium text-accent"
                  onClick={() =>
                    set({
                      recurrence: {
                        ...f.recurrence,
                        until: format(new Date(startDate.getFullYear(), startDate.getMonth() + 3, startDate.getDate()), 'yyyy-MM-dd'),
                      },
                    })
                  }
                >
                  nigdy (ustaw datę)
                </button>
              )}
            </div>
          )}
          {existing && existing.recurrence.freq !== 'none' && (
            <p className="mt-2 text-xs text-faint">Zmiany terminu dotyczą całej serii.</p>
          )}
        </Row>

        {existing?.snoozedUntil && new Date(existing.snoozedUntil) > new Date() && (
          <div className="flex items-center gap-2 rounded-2xl bg-[color-mix(in_oklab,var(--warn)_14%,transparent)] px-3.5 py-2.5 text-sm font-medium text-ink-2">
            <AlarmClock size={16} className="text-warn" />
            Drzemka do {fmt(new Date(existing.snoozedUntil), 'EEE HH:mm')}
            <div className="flex-1" />
            <button className="text-accent" onClick={() => updateReminder(existing.id, { snoozedUntil: null }).then(close)}>
              Anuluj drzemkę
            </button>
          </div>
        )}
      </div>

      {/* Akcje */}
      <div className="sticky bottom-0 -mx-5 mt-5 flex items-center gap-2 bg-surface px-5 pb-1 pt-3">
        {existing && (
          <button
            className="icon-btn text-danger hover:bg-danger-soft"
            aria-label="Usuń"
            onClick={async () => {
              close();
              await deleteWithToast(existing);
            }}
          >
            <Trash size={19} />
          </button>
        )}
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={close}>
          Anuluj
        </button>
        <button className="btn btn-primary min-w-28" onClick={save} disabled={!f.title.trim()}>
          {isNew ? 'Dodaj' : 'Zapisz'}
        </button>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1.5 grid h-5 w-5 shrink-0 place-items-center text-faint" aria-hidden>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="sr-only">{label}</div>
        {children}
      </div>
    </div>
  );
}

function PickerChip({
  type,
  value,
  onChange,
  label,
  icon,
  small,
}: {
  type: 'date' | 'time';
  value: string;
  onChange: (v: string) => void;
  label: string;
  icon?: ReactNode;
  small?: boolean;
}) {
  return (
    <label className={`chip relative cursor-pointer font-semibold text-ink ${small ? 'h-7 px-2.5 text-xs' : ''}`}>
      {icon}
      <span className="tnum">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => {
          try {
            (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
          } catch {
            /* niektóre przeglądarki nie pozwalają */
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        step={type === 'time' ? 300 : undefined}
      />
    </label>
  );
}
