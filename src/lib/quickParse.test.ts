import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { parseQuickAdd } from './quickParse';

// Czwartek, 19 listopada 2026, 10:00
const NOW = new Date(2026, 10, 19, 10, 0, 0);
const cats = [
  { id: 'c1', name: 'Praca' },
  { id: 'c2', name: 'Dom' },
  { id: 'c3', name: 'Zdrowie' },
];
const f = (d: Date | null) => (d ? format(d, 'yyyy-MM-dd HH:mm') : null);
const p = (s: string) => parseQuickAdd(s, NOW, cats);

describe('parseQuickAdd', () => {
  it('jutro 15:00 telefon do klienta', () => {
    const r = p('jutro 15:00 telefon do klienta');
    expect(r.title).toBe('Telefon do klienta');
    expect(f(r.date)).toBe('2026-11-20 15:00');
    expect(r.allDay).toBe(false);
  });

  it('godzina z „o”', () => {
    const r = p('spotkanie z Anią o 17');
    expect(r.title).toBe('Spotkanie z Anią');
    expect(f(r.date)).toBe('2026-11-19 17:00');
  });

  it('minęła godzina → jutro', () => {
    expect(f(p('o 8 siłownia').date)).toBe('2026-11-20 08:00');
  });

  it('pora dnia', () => {
    expect(f(p('jutro rano bieganie').date)).toBe('2026-11-20 09:00');
    expect(f(p('kino w sobotę o 8 wieczorem').date)).toBe('2026-11-21 20:00');
    expect(p('kino w sobotę o 8 wieczorem').title).toBe('Kino');
    expect(f(p('pojutrze 7 rano lot').date)).toBe('2026-11-21 07:00');
  });

  it('dni tygodnia', () => {
    expect(f(p('w poniedziałek raport').date)).toBe('2026-11-23 00:00');
    expect(p('w poniedziałek raport').allDay).toBe(true);
    expect(f(p('we wtorek o 9:30 dentysta').date)).toBe('2026-11-24 09:30');
    expect(f(p('w pt 12:00 lunch').date)).toBe('2026-11-20 12:00');
    expect(f(p('w przyszły czwartek przegląd').date)).toBe('2026-11-26 00:00');
    expect(f(p('w środę zebranie').date)).toBe('2026-11-25 00:00');
    expect(f(p('w czwartek o 9 kawa').date)).toBe('2026-11-26 09:00');
    expect(f(p('w czwartek o 18 kawa').date)).toBe('2026-11-19 18:00');
  });

  it('daty bezwzględne', () => {
    expect(f(p('15.12 urodziny mamy').date)).toBe('2026-12-15 00:00');
    expect(f(p('urodziny 3 stycznia').date)).toBe('2027-01-03 00:00');
    expect(f(p('2027-02-01 10:00 przegląd auta').date)).toBe('2027-02-01 10:00');
    expect(f(p('1.03.2027 o 14 wizyta').date)).toBe('2027-03-01 14:00');
    expect(f(p('wizyta 24 grudnia o 18:30').date)).toBe('2026-12-24 18:30');
  });

  it('kropka jako separator godziny', () => {
    expect(f(p('jutro 9.30 standup').date)).toBe('2026-11-20 09:30');
  });

  it('względne', () => {
    expect(f(p('za 2 godziny wyjąć pranie').date)).toBe('2026-11-19 12:00');
    expect(p('za 2 godziny wyjąć pranie').title).toBe('Wyjąć pranie');
    expect(f(p('za 15 min herbata').date)).toBe('2026-11-19 10:15');
    expect(f(p('za pół godziny przerwa').date)).toBe('2026-11-19 10:30');
    expect(f(p('za 3 dni oddać książkę').date)).toBe('2026-11-22 00:00');
    expect(f(p('za tydzień faktura').date)).toBe('2026-11-26 00:00');
  });

  it('powtarzanie', () => {
    const daily = p('codziennie 8:00 tabletki');
    expect(daily.recurrence?.freq).toBe('daily');
    expect(f(daily.date)).toBe('2026-11-20 08:00');
    expect(daily.title).toBe('Tabletki');

    const wd = p('w dni robocze 9:00 standup');
    expect(wd.recurrence?.freq).toBe('weekdays');
    expect(f(wd.date)).toBe('2026-11-20 09:00');

    const weekly = p('co poniedziałek 9:30 planowanie');
    expect(weekly.recurrence?.freq).toBe('weekly');
    expect(weekly.recurrence?.weekdays).toEqual([1]);
    expect(f(weekly.date)).toBe('2026-11-23 09:30');

    const multi = p('co wtorek i czwartek o 18 basen');
    expect(multi.recurrence?.weekdays.sort()).toEqual([2, 4]);
    expect(f(multi.date)).toBe('2026-11-19 18:00');
    expect(multi.title).toBe('Basen');

    const monthly = p('co miesiąc 10.12 czynsz');
    expect(monthly.recurrence?.freq).toBe('monthly');
    expect(monthly.recurrence?.monthDay).toBe(10);

    const custom = p('co 2 tygodnie sprzątanie');
    expect(custom.recurrence?.freq).toBe('custom');
    expect(custom.recurrence?.unit).toBe('week');
    expect(custom.recurrence?.interval).toBe(2);

    const custom3 = p('podlać kwiaty co 3 dni');
    expect(custom3.recurrence?.unit).toBe('day');
    expect(custom3.recurrence?.interval).toBe(3);
    expect(custom3.title).toBe('Podlać kwiaty');
  });

  it('priorytet i kategoria', () => {
    const r = p('jutro 10:00 prezentacja #praca !');
    expect(r.priority).toBe('high');
    expect(r.categoryId).toBe('c1');
    expect(r.title).toBe('Prezentacja');
    expect(p('zakupy !!').priority).toBe('medium');
    expect(p('zakupy !n').priority).toBe('low');
    expect(p('pilne oddzwonić').priority).toBe('high');
    const nc = p('trening #sport');
    expect(nc.categoryId).toBeNull();
    expect(nc.newCategoryName).toBe('Sport');
    expect(p('lekarz #zdr').categoryId).toBe('c3');
  });

  it('czas trwania', () => {
    const r = p('jutro 14:00 spotkanie przez 45 min');
    expect(r.durationMin).toBe(45);
    expect(r.title).toBe('Spotkanie');
    const range = p('warsztaty 13:00-16:30');
    expect(range.durationMin).toBe(210);
    expect(f(range.date)).toBe('2026-11-19 13:00');
    const od = p('jutro od 9 do 11 egzamin');
    expect(od.durationMin).toBe(120);
    expect(f(od.date)).toBe('2026-11-20 09:00');
  });

  it('bez daty', () => {
    const r = p('kupić mleko');
    expect(r.date).toBeNull();
    expect(r.title).toBe('Kupić mleko');
  });

  it('nie psuje tytułu z liczbami', () => {
    const r = p('jutro kupić 2 kg jabłek');
    expect(r.title).toBe('Kupić 2 kg jabłek');
    expect(r.allDay).toBe(true);
  });
});
