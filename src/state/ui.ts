import { create } from 'zustand';
import type { ReminderDraft } from '../lib/types';

export type Route = 'today' | 'calendar' | 'all' | 'counters' | 'settings';

const ROUTES: Route[] = ['today', 'calendar', 'all', 'counters', 'settings'];
const HASH: Record<Route, string> = { today: 'dzis', calendar: 'kalendarz', all: 'lista', counters: 'liczniki', settings: 'ustawienia' };

function routeFromHash(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  return ROUTES.find((r) => HASH[r] === h) ?? 'today';
}

export interface EditorState {
  open: boolean;
  reminderId: string | null;
  draft: Partial<ReminderDraft> | null;
  /** Dla serii – wystąpienie, z którego otwarto edytor. */
  occurrenceStart: string | null;
}

export interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'default' | 'success' | 'danger';
}

interface UiState {
  route: Route;
  navigate: (r: Route) => void;
  editor: EditorState;
  openEditor: (opts: { reminderId?: string; draft?: Partial<ReminderDraft>; occurrenceStart?: string }) => void;
  closeEditor: () => void;
  quickAddOpen: boolean;
  quickAddSeed: string;
  setQuickAdd: (open: boolean, seed?: string) => void;
  calendarDate: Date;
  setCalendarDate: (d: Date) => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  /** Filtr kategorii z bocznego panelu (desktop). */
  focusCategory: string | null;
  setFocusCategory: (id: string | null) => void;
}

let toastSeq = 1;

export const useUi = create<UiState>()((set, get) => ({
  route: routeFromHash(),
  navigate: (route) => {
    if (get().route === route) return;
    history.replaceState(null, '', `#/${HASH[route]}`);
    set({ route });
  },
  editor: { open: false, reminderId: null, draft: null, occurrenceStart: null },
  openEditor: ({ reminderId, draft, occurrenceStart }) =>
    set({
      editor: { open: true, reminderId: reminderId ?? null, draft: draft ?? null, occurrenceStart: occurrenceStart ?? null },
      quickAddOpen: false,
    }),
  closeEditor: () => set((s) => ({ editor: { ...s.editor, open: false } })),
  quickAddOpen: false,
  quickAddSeed: '',
  setQuickAdd: (open, seed = '') => set({ quickAddOpen: open, quickAddSeed: seed }),
  calendarDate: new Date(),
  setCalendarDate: (d) => set({ calendarDate: d }),
  toasts: [],
  toast: (t) => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => get().dismissToast(id), t.onAction ? 5500 : 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  focusCategory: null,
  setFocusCategory: (id) => set({ focusCategory: id }),
}));

window.addEventListener('hashchange', () => {
  const r = routeFromHash();
  if (useUi.getState().route !== r) useUi.setState({ route: r });
});

export const toast = (t: Omit<Toast, 'id'>) => useUi.getState().toast(t);
