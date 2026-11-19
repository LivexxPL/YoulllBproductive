import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { describeRecurrence, makeRecurrence, nextOccurrence, occurrencesInRange } from './recurrence';
import { NO_REPEAT, type Reminder } from './types';

const f = (d: Date | null) => (d ? format(d, 'yyyy-MM-dd HH:mm EEE') : null);

function reminder(start: Date, rec = NO_REPEAT): Reminder {
  return {
    id: 'r1',
    title: 'Test',
    notes: '',
    start: start.toISOString(),
    allDay: false,
    durationMin: 30,
    priority: 'medium',
    categoryId: null,
    recurrence: rec,
    completedAt: null,
    completions: [],
    snoozedUntil: null,
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
    deletedAt: null,
  };
}

describe('nextOccurrence', () => {
  const thu = new Date(2026, 10, 19, 9, 0); // czwartek

  it('codziennie', () => {
    expect(f(nextOccurrence(makeRecurrence('daily', thu), thu))).toBe('2026-11-20 09:00 Fri');
  });

  it('dni robocze pomijają weekend', () => {
    const fri = new Date(2026, 10, 20, 9, 0);
    expect(f(nextOccurrence(makeRecurrence('weekdays', fri), fri))).toBe('2026-11-23 09:00 Mon');
  });

  it('co tydzień w wybrane dni', () => {
    const rule = makeRecurrence('weekly', thu, { weekdays: [1, 4] });
    expect(f(nextOccurrence(rule, thu))).toBe('2026-11-23 09:00 Mon');
    const mon = new Date(2026, 10, 23, 9, 0);
    expect(f(nextOccurrence(rule, mon))).toBe('2026-11-26 09:00 Thu');
  });

  it('co 2 tygodnie', () => {
    const rule = makeRecurrence('custom', thu, { unit: 'week', interval: 2, weekdays: [4] });
    expect(f(nextOccurrence(rule, thu))).toBe('2026-12-03 09:00 Thu');
  });

  it('co miesiąc 31. bez dryfu', () => {
    const jan31 = new Date(2027, 0, 31, 8, 0);
    const rule = makeRecurrence('monthly', jan31);
    const feb = nextOccurrence(rule, jan31)!;
    expect(f(feb)).toBe('2027-02-28 08:00 Sun');
    expect(f(nextOccurrence(rule, feb))).toBe('2027-03-31 08:00 Wed');
  });

  it('until kończy serię', () => {
    const rule = { ...makeRecurrence('daily', thu), until: '2026-11-20' };
    const fri = nextOccurrence(rule, thu)!;
    expect(f(fri)).toBe('2026-11-20 09:00 Fri');
    expect(nextOccurrence(rule, fri)).toBeNull();
  });
});

describe('occurrencesInRange', () => {
  it('rozwija serię w zakresie', () => {
    const start = new Date(2026, 10, 19, 9, 0);
    const r = reminder(start, makeRecurrence('daily', start));
    const occ = occurrencesInRange(r, new Date(2026, 10, 20), new Date(2026, 10, 22, 23, 59));
    expect(occ.map((o) => f(o.start))).toEqual([
      '2026-11-20 09:00 Fri',
      '2026-11-21 09:00 Sat',
      '2026-11-22 09:00 Sun',
    ]);
  });

  it('pokazuje zrobione wystąpienia z historii', () => {
    const start = new Date(2026, 10, 20, 9, 0);
    const r = { ...reminder(start, makeRecurrence('daily', start)), completions: [new Date(2026, 10, 19, 9, 0).toISOString()] };
    const occ = occurrencesInRange(r, new Date(2026, 10, 19), new Date(2026, 10, 20, 23, 59));
    expect(occ.map((o) => [f(o.start), o.done])).toEqual([
      ['2026-11-19 09:00 Thu', true],
      ['2026-11-20 09:00 Fri', false],
    ]);
  });
});

describe('describeRecurrence', () => {
  const thu = new Date(2026, 10, 19, 9, 0);
  it('opisy po polsku', () => {
    expect(describeRecurrence(makeRecurrence('daily', thu), thu)).toBe('Codziennie');
    expect(describeRecurrence(makeRecurrence('weekly', thu, { weekdays: [1, 3] }), thu)).toBe('Co tydzień (pn, śr)');
    expect(describeRecurrence(makeRecurrence('custom', thu, { unit: 'day', interval: 3 }), thu)).toBe('Co 3 dni');
    expect(describeRecurrence(makeRecurrence('custom', thu, { unit: 'week', interval: 2, weekdays: [4] }), thu)).toBe(
      'Co 2 tygodnie (cz)',
    );
  });
});
