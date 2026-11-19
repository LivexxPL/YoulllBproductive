import {
  completeReminder,
  deleteReminder,
  restoreReminder,
  snoozeReminder,
  uncompleteReminder,
  type SnoozeOption,
} from '../data/actions';
import { dayLabel, formatTime } from '../lib/dates';
import { haptic } from '../lib/platform';
import type { Reminder } from '../lib/types';
import { toast } from '../state/ui';
import { isRecurring } from '../lib/recurrence';

/** Zrobione / cofnięte – z wibracją i „Cofnij”. */
export async function toggleDone(r: Reminder) {
  if (r.completedAt) {
    await uncompleteReminder(r);
    haptic('light');
    return;
  }
  const before = r;
  await completeReminder(r);
  haptic('success');
  toast({
    message: isRecurring(r) ? 'Zrobione – kolejne zaplanowane' : 'Zrobione',
    tone: 'success',
    actionLabel: 'Cofnij',
    onAction: () => restoreReminder(before),
  });
}

export async function snoozeWithToast(r: Reminder, opt: SnoozeOption) {
  const before = r;
  const target = await snoozeReminder(r, opt);
  haptic('light');
  toast({
    message: `Drzemka do ${dayLabel(target).toLowerCase() === 'dziś' ? '' : dayLabel(target) + ', '}${formatTime(target)}`,
    actionLabel: 'Cofnij',
    onAction: () => restoreReminder(before),
  });
}

export async function deleteWithToast(r: Reminder) {
  const before = r;
  await deleteReminder(r.id);
  haptic('medium');
  toast({ message: 'Usunięto', tone: 'danger', actionLabel: 'Cofnij', onAction: () => restoreReminder(before) });
}

export const SNOOZE_OPTIONS: Array<{ value: SnoozeOption; label: string; hint: string }> = [
  { value: 5, label: '5 minut', hint: '+5 min' },
  { value: 15, label: '15 minut', hint: '+15 min' },
  { value: 60, label: '1 godzina', hint: '+1 h' },
  { value: 'tomorrow', label: 'Jutro', hint: '' },
];
