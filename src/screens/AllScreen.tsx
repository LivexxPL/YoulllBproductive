import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Flag, Search, SearchX, X } from 'lucide-react';
import { ReminderRow } from '../components/ReminderRow';
import { ScreenHeader, SectionTitle } from '../components/ScreenHeader';
import { useCategories, useCategoryMap, useReminders } from '../data/store';
import { filterReminders, groupForList, type ReminderFilter } from '../lib/agenda';
import { colorHex, PRIORITY_META } from '../lib/colors';
import { useNow } from '../lib/hooks';
import type { Priority } from '../lib/types';
import { useUi } from '../state/ui';

const STATUS: Array<{ value: ReminderFilter['status']; label: string }> = [
  { value: 'active', label: 'Aktywne' },
  { value: 'done', label: 'Zrobione' },
  { value: 'all', label: 'Wszystkie' },
];

export function AllScreen() {
  const reminders = useReminders();
  const categories = useCategories();
  const catMap = useCategoryMap();
  const now = useNow(60_000);
  const focusCategory = useUi((s) => s.focusCategory);
  const setFocusCategory = useUi((s) => s.setFocusCategory);
  const [query, setQuery] = useState('');
  const [cats, setCats] = useState<string[]>(focusCategory ? [focusCategory] : []);
  const [prios, setPrios] = useState<Priority[]>([]);
  const [status, setStatus] = useState<ReminderFilter['status']>('active');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCats(focusCategory ? [focusCategory] : []);
  }, [focusCategory]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const names = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const filtered = useMemo(
    () => filterReminders(reminders, { query, categories: cats, priorities: prios, status }, names),
    [reminders, query, cats, prios, status, names],
  );
  const groups = useMemo(() => groupForList(filtered, now), [filtered, now]);

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const anyFilter = query || cats.length || prios.length || status !== 'active';

  return (
    <div className="mx-auto max-w-2xl">
      <ScreenHeader title="Wszystkie" subtitle={`${filtered.length} ${filtered.length === 1 ? 'przypomnienie' : 'przypomnień'}`} />

      <div className="sticky top-0 z-20 bg-bg/85 px-3 pb-2 pt-1 backdrop-blur-xl sm:px-5 lg:px-8">
        <div className="flex items-center gap-2.5 rounded-2xl bg-surface px-3.5 shadow-[var(--shadow-card)] focus-within:shadow-[0_0_0_1.5px_var(--accent),0_0_0_5px_var(--accent-soft)]">
          <Search size={18} className="shrink-0 text-faint" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj w tytułach i notatkach"
            className="h-12 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-faint"
            type="search"
            enterKeyHint="search"
          />
          {query && (
            <button className="icon-btn h-8 w-8" onClick={() => setQuery('')} aria-label="Wyczyść">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="scrollbar-none -mx-3 mt-2.5 flex gap-1.5 overflow-x-auto px-3 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
          <div className="flex shrink-0 gap-1 rounded-full bg-surface-2 p-0.5">
            {STATUS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={`h-7 rounded-full px-3 text-[0.8125rem] font-semibold transition-all ${
                  status === s.value ? 'bg-surface text-ink shadow-sm' : 'text-muted'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="mx-0.5 w-px shrink-0 bg-line" />
          {(['high', 'medium', 'low'] as Priority[]).map((p) => {
            const active = prios.includes(p);
            return (
              <button
                key={p}
                className="chip h-8 shrink-0"
                onClick={() => setPrios((a) => toggle(a, p))}
                style={active ? { background: PRIORITY_META[p].hex, color: '#fff' } : undefined}
              >
                <Flag size={13} fill={active ? '#fff' : 'none'} style={{ color: active ? '#fff' : PRIORITY_META[p].hex }} />
                {PRIORITY_META[p].label}
              </button>
            );
          })}
          <span className="mx-0.5 w-px shrink-0 bg-line" />
          {categories.map((c) => {
            const active = cats.includes(c.id);
            const hex = colorHex(c.color);
            return (
              <button
                key={c.id}
                className="chip h-8 shrink-0"
                onClick={() => {
                  setCats((a) => toggle(a, c.id));
                  if (focusCategory) setFocusCategory(null);
                }}
                style={active ? { background: hex, color: '#fff' } : undefined}
              >
                <span className="dot" style={{ ['--c' as string]: active ? '#fff' : hex }} />
                {c.name}
              </button>
            );
          })}
          <button className="chip h-8 shrink-0" data-active={cats.includes('none')} onClick={() => setCats((a) => toggle(a, 'none'))}>
            Bez kategorii
          </button>
        </div>
      </div>

      <div className="space-y-4 px-3 pt-2 sm:px-5 lg:px-8">
        <AnimatePresence initial={false}>
          {groups.map((g) => (
            <motion.section
              key={g.key}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card px-1.5 py-2.5"
            >
              <SectionTitle tone={g.tone === 'danger' ? 'danger' : undefined} count={g.items.length}>
                {g.label}
              </SectionTitle>
              <AnimatePresence initial={false}>
                {g.items.map((r) => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    category={r.categoryId ? catMap.get(r.categoryId) : undefined}
                    now={now}
                    timeMode={g.key === 'overdue' ? 'relative' : 'date'}
                    tone={g.key === 'overdue' ? 'danger' : undefined}
                    showSnooze={g.key === 'overdue'}
                  />
                ))}
              </AnimatePresence>
            </motion.section>
          ))}
        </AnimatePresence>

        {!groups.length && (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-surface-2 text-faint">
              <SearchX size={28} />
            </div>
            <div className="font-display text-lg font-semibold">{anyFilter ? 'Nic nie pasuje' : 'Pusto'}</div>
            <p className="mt-1 text-sm text-muted">
              {anyFilter ? 'Spróbuj innej frazy albo wyłącz filtry.' : 'Dodaj przypomnienie przyciskiem „+”.'}
            </p>
            {anyFilter && (
              <button
                className="btn btn-ghost mt-4 h-10 text-sm"
                onClick={() => {
                  setQuery('');
                  setCats([]);
                  setPrios([]);
                  setStatus('active');
                  setFocusCategory(null);
                }}
              >
                Wyczyść filtry
              </button>
            )}
          </div>
        )}
        <div className="h-6" />
      </div>
    </div>
  );
}
