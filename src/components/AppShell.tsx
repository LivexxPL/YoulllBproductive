import { useEffect, useMemo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, ListTodo, Plus, Settings, Sun } from 'lucide-react';
import { LogoMark, Wordmark } from './Logo';
import { MiniMonth } from './MiniMonth';
import { useCategories, useReminders } from '../data/store';
import { buildToday } from '../lib/agenda';
import { colorHex } from '../lib/colors';
import { useNow } from '../lib/hooks';
import { useSettings } from '../state/settings';
import { useUi, type Route } from '../state/ui';

const NAV: Array<{ route: Route; label: string; icon: typeof Sun }> = [
  { route: 'today', label: 'Dziś', icon: Sun },
  { route: 'calendar', label: 'Kalendarz', icon: CalendarDays },
  { route: 'all', label: 'Wszystkie', icon: ListTodo },
  { route: 'settings', label: 'Ustawienia', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const route = useUi((s) => s.route);
  const navigate = useUi((s) => s.navigate);
  const setQuickAdd = useUi((s) => s.setQuickAdd);
  const reminders = useReminders();
  const now = useNow(60_000);
  const today = useMemo(() => buildToday(reminders, now), [reminders, now]);
  const badge = today.now.length + today.next.length + today.allDay.length + today.overdue.length;

  // Skróty klawiaturowe: N – nowe, 1–4 – ekrany
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setQuickAdd(true);
        }
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'n' || e.key === 'q') {
        e.preventDefault();
        setQuickAdd(true);
      } else if (['1', '2', '3', '4'].includes(e.key)) navigate(NAV[Number(e.key) - 1].route);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, setQuickAdd]);

  return (
    <div className="flex min-h-full">
      <Sidebar route={route} badge={badge} overdue={today.overdue.length} />
      <main className="relative min-w-0 flex-1 pb-[calc(5.5rem+var(--safe-bottom))] lg:pb-0">{children}</main>
      <BottomNav route={route} badge={badge} />
      {route !== 'settings' && (
        <motion.button
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', damping: 18, stiffness: 320 }}
          onClick={() => setQuickAdd(true)}
          aria-label="Dodaj przypomnienie"
          className="fixed bottom-[calc(5.25rem+var(--safe-bottom))] right-[calc(1.125rem+var(--safe-right))] z-40 grid h-14 w-14 place-items-center rounded-[1.25rem] bg-gradient-to-br from-[#6D8BFF] via-[#4F6BF5] to-[#7A4FE0] text-white shadow-[var(--shadow-fab)] lg:hidden"
        >
          <Plus size={26} strokeWidth={2.5} />
        </motion.button>
      )}
    </div>
  );
}

function Sidebar({ route, badge, overdue }: { route: Route; badge: number; overdue: number }) {
  const navigate = useUi((s) => s.navigate);
  const setQuickAdd = useUi((s) => s.setQuickAdd);
  const calendarDate = useUi((s) => s.calendarDate);
  const setCalendarDate = useUi((s) => s.setCalendarDate);
  const focusCategory = useUi((s) => s.focusCategory);
  const setFocusCategory = useUi((s) => s.setFocusCategory);
  const categories = useCategories();
  const reminders = useReminders();
  const setSettings = useSettings((s) => s.set);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reminders) if (!r.completedAt && r.categoryId) m.set(r.categoryId, (m.get(r.categoryId) ?? 0) + 1);
    return m;
  }, [reminders]);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[17.5rem] shrink-0 flex-col border-r border-line bg-surface/60 px-4 pb-4 pt-5 lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <LogoMark size={34} />
        <Wordmark />
      </div>

      <button
        onClick={() => setQuickAdd(true)}
        className="btn btn-primary mt-6 h-11 w-full justify-start rounded-2xl bg-gradient-to-br from-[#6D8BFF] via-[#4F6BF5] to-[#7A4FE0] px-4 text-white"
      >
        <Plus size={19} strokeWidth={2.5} />
        <span className="flex-1 text-left">Nowe przypomnienie</span>
        <kbd className="rounded-md bg-white/20 px-1.5 py-0.5 font-sans text-[0.6875rem] font-semibold">N</kbd>
      </button>

      <nav className="mt-5 space-y-0.5">
        {NAV.map(({ route: r, label, icon: Icon }) => {
          const active = route === r;
          return (
            <button
              key={r}
              onClick={() => {
                if (r === 'all') setFocusCategory(null);
                navigate(r);
              }}
              className={`relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium transition-colors ${
                active ? 'text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-surface shadow-[var(--shadow-card)]"
                  transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                />
              )}
              <Icon size={19} className={`relative ${active ? 'text-accent' : ''}`} />
              <span className="relative flex-1 text-left">{label}</span>
              {r === 'today' && badge > 0 && (
                <span
                  className={`tnum relative rounded-full px-2 py-0.5 text-xs font-semibold ${
                    overdue ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-muted'
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 rounded-2xl bg-surface p-3 shadow-[var(--shadow-card)]">
        <MiniMonth
          selected={calendarDate}
          onSelect={(d) => {
            setCalendarDate(d);
            setSettings({ calendarView: 'day' });
            navigate('calendar');
          }}
        />
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        <div className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">Kategorie</div>
        {categories.map((c) => {
          const active = focusCategory === c.id && route === 'all';
          return (
            <button
              key={c.id}
              onClick={() => {
                setFocusCategory(active ? null : c.id);
                navigate('all');
              }}
              className={`flex h-9 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                active ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorHex(c.color) }} />
              <span className="flex-1 truncate text-left">{c.name}</span>
              <span className="tnum text-xs text-faint">{counts.get(c.id) ?? ''}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function BottomNav({ route, badge }: { route: Route; badge: number }) {
  const navigate = useUi((s) => s.navigate);
  const setFocusCategory = useUi((s) => s.setFocusCategory);
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-safe lg:hidden">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4 px-2">
        {NAV.map(({ route: r, label, icon: Icon }) => {
          const active = route === r;
          return (
            <button
              key={r}
              onClick={() => {
                if (r === 'all') setFocusCategory(null);
                navigate(r);
              }}
              className="relative flex flex-col items-center justify-center gap-0.5"
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative grid h-8 w-14 place-items-center">
                {active && (
                  <motion.span
                    layoutId="bottom-active"
                    className="absolute inset-0 rounded-full bg-accent-soft"
                    transition={{ type: 'spring', damping: 28, stiffness: 420 }}
                  />
                )}
                <Icon size={21} strokeWidth={active ? 2.3 : 1.9} className={`relative transition-colors ${active ? 'text-accent' : 'text-muted'}`} />
                {r === 'today' && badge > 0 && (
                  <span className="tnum absolute -right-0.5 -top-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-danger px-1 text-[0.625rem] font-bold text-white ring-2 ring-[var(--surface)]">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              <span className={`text-[0.6875rem] font-semibold transition-colors ${active ? 'text-ink' : 'text-muted'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
