/**
 * Parser szybkiego dodawania – rozpoznaje datę, godzinę, powtarzanie,
 * priorytet, kategorię i czas trwania w zdaniu po polsku, np.:
 *
 *   „jutro 15:00 telefon do klienta”
 *   „w piątek o 8 wieczorem kino #osobiste”
 *   „co poniedziałek 9:30 stand-up przez 15 min”
 *   „za 2 godziny wyjąć pranie !”
 */
import { addDays, addMinutes, addMonths, addWeeks, addYears, startOfDay, startOfWeek } from 'date-fns';
import { alignToRule, makeRecurrence } from './recurrence';
import type { Priority, Recurrence, RepeatUnit } from './types';

export interface QuickParseCategory {
  id: string;
  name: string;
}

export interface QuickParseResult {
  title: string;
  /** Data (i godzina, jeśli `allDay` = false). null = nic nie rozpoznano. */
  date: Date | null;
  allDay: boolean;
  hasDate: boolean;
  hasTime: boolean;
  recurrence: Recurrence | null;
  priority: Priority | null;
  categoryId: string | null;
  /** Nazwa kategorii z `#nazwa`, której jeszcze nie ma. */
  newCategoryName: string | null;
  durationMin: number | null;
  matched: string[];
}

const L = '\\p{L}';
const B = `(?<![${L}\\d])`; // granica słowa (działa z polskimi znakami)
const E = `(?![${L}\\d])`;

const DAY_FULL: Record<string, number> = {
  poniedziałek: 1, poniedzialek: 1,
  wtorek: 2,
  środa: 3, środę: 3, sroda: 3, srode: 3, środy: 3,
  czwartek: 4,
  piątek: 5, piatek: 5,
  sobota: 6, sobotę: 6, sobote: 6, soboty: 6,
  niedziela: 0, niedzielę: 0, niedziele: 0, niedzieli: 0,
};
const DAY_ABBR: Record<string, number> = {
  pon: 1, pn: 1, wt: 2, wto: 2, śr: 3, sr: 3, czw: 4, cz: 4, pt: 5, pią: 5, pia: 5, sob: 6, sb: 6, nd: 0, ndz: 0, niedz: 0,
};
const DAY_FULL_RE = Object.keys(DAY_FULL).sort((a, b) => b.length - a.length).join('|');
const DAY_ABBR_RE = Object.keys(DAY_ABBR).sort((a, b) => b.length - a.length).join('|');
const DAY_ANY_RE = `${DAY_FULL_RE}|${DAY_ABBR_RE}`;

const MONTHS: Record<string, number> = {
  stycznia: 0, styczeń: 0, styczen: 0, sty: 0,
  lutego: 1, luty: 1, lut: 1,
  marca: 2, marzec: 2, mar: 2,
  kwietnia: 3, kwiecień: 3, kwiecien: 3, kwi: 3,
  maja: 4, maj: 4,
  czerwca: 5, czerwiec: 5, cze: 5,
  lipca: 6, lipiec: 6, lip: 6,
  sierpnia: 7, sierpień: 7, sierpien: 7, sie: 7,
  września: 8, wrzesnia: 8, wrzesień: 8, wrzesien: 8, wrz: 8,
  października: 9, pazdziernika: 9, październik: 9, paź: 9, paz: 9,
  listopada: 10, listopad: 10, lis: 10,
  grudnia: 11, grudzień: 11, grudzien: 11, gru: 11,
};
const MONTHS_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

const NUM_WORDS: Record<string, number> = {
  jeden: 1, jedną: 1, jedna: 1, dwa: 2, dwie: 2, trzy: 3, cztery: 4, pięć: 5, piec: 5, sześć: 6, siedem: 7,
  osiem: 8, dziewięć: 9, dziesięć: 10, piętnaście: 15, dwadzieścia: 20, trzydzieści: 30, czterdzieści: 40,
  drugi: 2, drugą: 2, drugie: 2, trzeci: 3, trzecią: 3, trzecie: 3, czwarty: 4, czwartą: 4,
};
const NUM_WORDS_RE = Object.keys(NUM_WORDS).sort((a, b) => b.length - a.length).join('|');

type PartOfDay = 'morning' | 'forenoon' | 'noon' | 'afternoon' | 'evening' | 'night';
const PART_DEFAULT: Record<PartOfDay, [number, number]> = {
  morning: [9, 0],
  forenoon: [10, 0],
  noon: [12, 0],
  afternoon: [15, 0],
  evening: [19, 0],
  night: [22, 0],
};

function partOf(word: string): PartOfDay | null {
  const w = word.toLowerCase().replace(/\s+/g, ' ');
  if (/^(rano|z rana|rankiem|nad ranem)$/.test(w)) return 'morning';
  if (/^przed południem|przed poludniem$/.test(w)) return 'forenoon';
  if (/^(w )?(południe|poludnie)$/.test(w)) return 'noon';
  if (/^po (południu|poludniu)$/.test(w)) return 'afternoon';
  if (/^(wieczorem|wieczór|wieczor)$/.test(w)) return 'evening';
  if (/^(w nocy|nocą|noca)$/.test(w)) return 'night';
  return null;
}

const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .trim();

function toNumber(s: string): number {
  const n = Number(s.replace(',', '.'));
  if (!Number.isNaN(n)) return n;
  return NUM_WORDS[s.toLowerCase()] ?? NaN;
}

function unitOf(word: string): 'min' | 'hour' | RepeatUnit | null {
  const w = word.toLowerCase().replace(/\.$/, '');
  if (/^(min|minut|minuty|minutę|minute|minuta)$/.test(w)) return 'min';
  if (/^(h|godz|godzin|godziny|godzinę|godzine|godzina)$/.test(w)) return 'hour';
  if (/^(dzień|dzien|dni|dnia)$/.test(w)) return 'day';
  if (/^(tydzień|tydzien|tygodnie|tygodni|tygodnia)$/.test(w)) return 'week';
  if (/^(miesiąc|miesiac|miesiące|miesiace|miesięcy|miesiecy|miesiąca)$/.test(w)) return 'month';
  if (/^(rok|lata|lat|roku)$/.test(w)) return 'year';
  return null;
}

export function parseQuickAdd(
  input: string,
  now: Date = new Date(),
  categories: QuickParseCategory[] = [],
): QuickParseResult {
  // Maskujemy rozpoznane fragmenty (te same długości), żeby kolejne reguły ich nie łapały.
  let work = input;
  const matched: string[] = [];

  const take = (pattern: string, handler: (m: RegExpExecArray) => boolean | void) => {
    const re = new RegExp(pattern, 'giu');
    let m: RegExpExecArray | null;
    const hits: Array<[number, number]> = [];
    while ((m = re.exec(work))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      if (handler(m) !== false) {
        hits.push([m.index, m.index + m[0].length]);
        matched.push(m[0].trim());
      }
    }
    for (const [s, e] of hits) work = work.slice(0, s) + '\u0000'.repeat(e - s) + work.slice(e);
  };

  let day: Date | null = null;
  let explicitDay = false;
  let time: { h: number; m: number } | null = null;
  let part: PartOfDay | null = null;
  let relative: Date | null = null;
  let recurrence: Recurrence | null = null;
  let weeklyDays: number[] | null = null;
  let priority: Priority | null = null;
  let categoryId: string | null = null;
  let newCategoryName: string | null = null;
  let durationMin: number | null = null;
  let nextWeekFlag = false;

  const today = startOfDay(now);

  // 1) Kategoria: #praca
  take(`(?<!\\S)#([${L}\\d_\\-]+)`, (m) => {
    if (categoryId || newCategoryName) return false;
    const key = normalizeName(m[1]);
    const found = categories.find((c) => normalizeName(c.name) === key) ??
      categories.find((c) => normalizeName(c.name).startsWith(key));
    if (found) categoryId = found.id;
    else newCategoryName = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  });

  // 2) Priorytet: !, !!, !!!, !w / !wysoki, !ś / !średni, !n / !niski, „pilne”, „asap”
  take(`(?<!\\S)(!{1,3})([${L}]*)(?!\\S)`, (m) => {
    const word = normalizeName(m[2] ?? '');
    if (!word) priority = m[1].length === 2 ? 'medium' : 'high';
    else if (/^(w|wys|wysoki|wysoka|p|pilne)/.test(word)) priority = 'high';
    else if (/^(s|sr|sredni|srednia)/.test(word)) priority = 'medium';
    else if (/^(n|nis|niski|niska)/.test(word)) priority = 'low';
    else return false;
  });
  take(`${B}(pilne|pilnie|asap)${E}`, () => {
    priority = 'high';
  });

  // 3) Zakres godzin: 15:00-16:30, od 15 do 17
  take(`${B}(?:od\\s+)?(\\d{1,2})[:.](\\d{2})\\s*(?:-|–|do)\\s*(\\d{1,2})[:.](\\d{2})${E}`, (m) => {
    const [h1, m1, h2, m2] = [m[1], m[2], m[3], m[4]].map(Number);
    if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return false;
    time = { h: h1, m: m1 };
    let diff = h2 * 60 + m2 - (h1 * 60 + m1);
    if (diff <= 0) diff += 24 * 60;
    durationMin = diff;
  });
  take(`${B}od\\s+(?:godz\\.?\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s+do\\s+(\\d{1,2})(?:[:.](\\d{2}))?${E}`, (m) => {
    const h1 = Number(m[1]);
    const m1 = Number(m[2] ?? 0);
    const h2 = Number(m[3]);
    const m2 = Number(m[4] ?? 0);
    if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return false;
    time = { h: h1, m: m1 };
    let diff = h2 * 60 + m2 - (h1 * 60 + m1);
    if (diff <= 0) diff += 24 * 60;
    durationMin = diff;
  });

  // 4) Czas trwania: przez 30 min, przez 2h, przez godzinę
  take(`${B}przez\\s+(\\d+(?:[.,]\\d+)?)\\s*(min\\.?|minut[yaę]?|h|godz\\.?|godzin[yaę]?)${E}`, (m) => {
    const n = toNumber(m[1]);
    const u = unitOf(m[2]);
    durationMin = Math.round(u === 'hour' ? n * 60 : n);
  });
  take(`${B}przez\\s+(godzinę|godzine|pół\\s+godziny|pol\\s+godziny|kwadrans|półtorej\\s+godziny|poltorej\\s+godziny)${E}`, (m) => {
    const w = normalizeName(m[1]);
    durationMin = w.startsWith('godzin') ? 60 : w.startsWith('pol godz') ? 30 : w.startsWith('kwadrans') ? 15 : 90;
  });

  // 5) Powtarzanie
  take(`${B}(codziennie|co\\s+dzie[ńn]|ka[żz]dego\\s+dnia)${E}`, () => {
    recurrence = makeRecurrence('daily', now);
  });
  take(
    `${B}(w\\s+dni\\s+robocze|w\\s+dni\\s+powszednie|w\\s+ka[żz]dy\\s+dzie[ńn]\\s+roboczy|od\\s+poniedzia[łl]ku\\s+do\\s+pi[ąa]tku|pn\\s*-\\s*pt|pon\\s*-\\s*pt)${E}`,
    () => {
      recurrence = makeRecurrence('weekdays', now);
    },
  );
  take(`${B}(co\\s+tydzie[ńn]|co\\s+tygodnia|cotygodniowo|ka[żz]dego\\s+tygodnia)${E}`, () => {
    recurrence = makeRecurrence('weekly', now);
  });
  take(`${B}(co\\s+miesi[ąa]c|comiesi[ęe]cznie|ka[żz]dego\\s+miesi[ąa]ca)${E}`, () => {
    recurrence = makeRecurrence('monthly', now);
  });
  take(`${B}(co\\s+rok|co\\s+roku|corocznie|ka[żz]dego\\s+roku)${E}`, () => {
    recurrence = makeRecurrence('custom', now, { unit: 'year', interval: 1 });
  });
  take(
    `${B}co\\s+(\\d+|${NUM_WORDS_RE})\\s+(dni|dzie[ńn]|tygodnie|tygodni|tydzie[ńn]|miesi[ąa]ce|miesi[ęe]cy|miesi[ąa]c|lata|lat|rok)${E}`,
    (m) => {
      const n = toNumber(m[1]);
      const u = unitOf(m[2]);
      if (!n || !u || u === 'min' || u === 'hour') return false;
      recurrence = makeRecurrence('custom', now, { unit: u, interval: n });
    },
  );
  take(
    `${B}(?:co|w\\s+ka[żz]d[yąae]|we\\s+wszystkie|ka[żz]d[yąae])\\s+((?:${DAY_ANY_RE})\\.?(?:\\s*(?:,|i|oraz)\\s*(?:w\\s+|we\\s+)?(?:${DAY_ANY_RE})\\.?)*)${E}`,
    (m) => {
      const names = m[1].toLowerCase().split(/\s*(?:,|\bi\b|oraz)\s*/u).map((s) => s.replace(/^(w|we)\s+/, '').replace(/\.$/, '').trim());
      const days = names.map((n) => DAY_FULL[n] ?? DAY_ABBR[n]).filter((d): d is number => d !== undefined);
      if (!days.length) return false;
      weeklyDays = [...new Set(days)];
      recurrence = makeRecurrence('weekly', now, { weekdays: weeklyDays });
    },
  );

  // 6) Względne: za 15 min, za 2 godziny, za tydzień
  take(`${B}za\\s+(pół\\s+godziny|pol\\s+godziny|kwadrans|godzinę|godzine|minutę|minute|półtorej\\s+godziny)${E}`, (m) => {
    const w = normalizeName(m[1]);
    const mins = w.startsWith('pol godz') ? 30 : w.startsWith('kwadrans') ? 15 : w.startsWith('godzin') ? 60 : w.startsWith('minut') ? 1 : 90;
    relative = addMinutes(now, mins);
  });
  take(
    `${B}za\\s+(\\d+(?:[.,]\\d+)?|${NUM_WORDS_RE})\\s*(min\\.?|minut[yaę]?|h|godz\\.?|godzin[yaę]?|dni|dzie[ńn]|tygodnie|tygodni|tydzie[ńn]|miesi[ąa]ce|miesi[ęe]cy|miesi[ąa]c|lata|lat|rok)${E}`,
    (m) => {
      const n = toNumber(m[1]);
      const u = unitOf(m[2]);
      if (!n || !u) return false;
      if (u === 'min') relative = addMinutes(now, Math.round(n));
      else if (u === 'hour') relative = addMinutes(now, Math.round(n * 60));
      else {
        day = u === 'day' ? addDays(today, n) : u === 'week' ? addWeeks(today, n) : u === 'month' ? addMonths(today, n) : addYears(today, n);
        explicitDay = true;
      }
    },
  );
  take(`${B}za\\s+(dzie[ńn]|tydzie[ńn]|miesi[ąa]c|rok)${E}`, (m) => {
    const u = unitOf(m[1]);
    day = u === 'day' ? addDays(today, 1) : u === 'week' ? addWeeks(today, 1) : u === 'month' ? addMonths(today, 1) : addYears(today, 1);
    explicitDay = true;
  });

  // 7) Słowa dnia
  take(`${B}(pojutrze|jutro|dzi[śs]|dzisiaj|wieczorem\\s+dzi[śs])${E}`, (m) => {
    if (day) return false;
    const w = normalizeName(m[1]);
    day = w === 'pojutrze' ? addDays(today, 2) : w === 'jutro' ? addDays(today, 1) : today;
    explicitDay = true;
  });

  // 8) Dzień tygodnia: w piątek, we wtorek, w przyszły poniedziałek, w pt
  const weekdayHandler = (modifier: string | undefined, name: string) => {
    if (day) return false;
    const key = name.toLowerCase().replace(/\.$/, '');
    const dow = DAY_FULL[key] ?? DAY_ABBR[key];
    if (dow === undefined) return false;
    const mod = modifier ? normalizeName(modifier) : '';
    if (/^(przyszl|nastepn)/.test(mod)) {
      const nextWeekStart = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
      day = addDays(nextWeekStart, (dow + 6) % 7);
      nextWeekFlag = true;
    } else {
      const diff = (dow - today.getDay() + 7) % 7;
      day = addDays(today, diff);
    }
    explicitDay = true;
  };
  take(
    `${B}(?:(w|we)\\s+)?(?:(przyszły|przyszłą|przyszly|przyszla|następny|następną|nastepny|nastepna|ten|tę|te)\\s+)?(${DAY_FULL_RE})${E}`,
    (m) => weekdayHandler(m[2], m[3]),
  );
  take(
    `${B}(w|we)\\s+(?:(przyszły|przyszłą|przyszly|przyszla|następny|następną|nastepny|nastepna)\\s+)?(${DAY_ABBR_RE})\\.?${E}`,
    (m) => weekdayHandler(m[2], m[3]),
  );

  // 9) Godzina z przyimkiem: o 15, o 15:30, o godz. 8.15, godz. 9
  take(`${B}(?:o\\s+godz(?:\\.|inie)?|o|godz\\.?|godzina)\\s*(\\d{1,2})(?:[:.](\\d{2}))?(?:\\s*h)?${E}`, (m) => {
    if (time) return false;
    const h = Number(m[1]);
    const mm = Number(m[2] ?? 0);
    if (h > 24 || mm > 59) return false;
    time = { h: h === 24 ? 0 : h, m: mm };
  });

  // 10) Daty bezwzględne
  take(`${B}(\\d{4})-(\\d{1,2})-(\\d{1,2})${E}`, (m) => {
    if (day && !explicitDay) return false;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (Number.isNaN(d.getTime())) return false;
    day = d;
    explicitDay = true;
  });
  take(`${B}(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{4}|\\d{2}))?${E}`, (m) => {
    const dd = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return false;
    let y = m[3] ? Number(m[3]) : today.getFullYear();
    if (y < 100) y += 2000;
    let d = new Date(y, mo - 1, dd);
    if (d.getMonth() !== mo - 1) return false;
    if (!m[3] && d < today) d = new Date(y + 1, mo - 1, dd);
    day = d;
    explicitDay = true;
  });
  take(`${B}(\\d{1,2})\\s+(${MONTHS_RE})\\.?(?:\\s+(\\d{4}))?${E}`, (m) => {
    const dd = Number(m[1]);
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo === undefined || dd < 1 || dd > 31) return false;
    const y = m[3] ? Number(m[3]) : today.getFullYear();
    let d = new Date(y, mo, dd);
    if (d.getMonth() !== mo) return false;
    if (!m[3] && d < today) d = new Date(y + 1, mo, dd);
    day = d;
    explicitDay = true;
  });

  // 11) Gołe godziny: 15:00, 9.30
  take(`${B}(\\d{1,2})[:.](\\d{2})(?:\\s*h)?${E}`, (m) => {
    if (time) return false;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (h > 23 || mm > 59) return false;
    time = { h, m: mm };
  });

  // 12) Godzina z porą dnia: 8 rano, 7 wieczorem
  take(`${B}(\\d{1,2})\\s+(rano|wieczorem|po\\s+po[łl]udniu|w\\s+nocy|nad\\s+ranem)${E}`, (m) => {
    if (time) return false;
    const h = Number(m[1]);
    if (h > 23) return false;
    time = { h, m: 0 };
    part = partOf(m[2]);
  });

  // 13) Pora dnia: rano, po południu, wieczorem
  take(`${B}(rano|z\\s+rana|rankiem|przed\\s+po[łl]udniem|w\\s+po[łl]udnie|po\\s+po[łl]udniu|wieczorem|wiecz[óo]r|w\\s+nocy)${E}`, (m) => {
    if (part) return false;
    part = partOf(m[1]);
  });

  // ——— Składanie wyniku ———
  let t = time as { h: number; m: number } | null;
  const p = part as PartOfDay | null;
  if (t && p && t.h < 12 && (p === 'afternoon' || p === 'evening' || (p === 'night' && t.h >= 6))) {
    t = { h: t.h + 12, m: t.m };
  }
  if (!t && p) t = { h: PART_DEFAULT[p][0], m: PART_DEFAULT[p][1] };

  let date: Date | null = null;
  let allDay = false;
  const rel = relative as Date | null;
  let d0 = day as Date | null;

  if (rel && !t && !d0) {
    date = new Date(rel);
    date.setSeconds(0, 0);
  } else if (d0 && t) {
    date = new Date(d0);
    date.setHours(t.h, t.m, 0, 0);
    // „w piątek o 9”, gdy dziś piątek i 9:00 minęła → za tydzień
    if (date <= now && !nextWeekFlag && explicitDay && d0.getTime() === today.getTime() && weekdayOnly(matched)) {
      date = addDays(date, 7);
    }
  } else if (d0) {
    date = new Date(d0);
    allDay = true;
  } else if (t) {
    date = new Date(today);
    date.setHours(t.h, t.m, 0, 0);
    if (date <= now) date = addDays(date, 1);
  }

  const rec = recurrence as Recurrence | null;
  if (rec) {
    if (!date) {
      date = new Date(today);
      allDay = true;
    }
    if (!d0) {
      // Pierwsze wystąpienie wyrównaj do reguły (np. najbliższy poniedziałek)
      const aligned = alignToRule(rec, date);
      if (aligned.getTime() !== date.getTime()) date = aligned;
      if (!allDay && date <= now) {
        let next = alignToRule(rec, addDays(date, 1));
        if (rec.freq === 'monthly') next = addMonths(date, 1);
        date = next;
      }
    }
    if (rec.freq === 'weekly' && !weeklyDays) rec.weekdays = [date.getDay()];
    if (rec.freq === 'monthly' || (rec.freq === 'custom' && rec.unit === 'month')) rec.monthDay = date.getDate();
    if (rec.freq === 'custom' && rec.unit === 'week' && !rec.weekdays.length) rec.weekdays = [date.getDay()];
  }
  const title = cleanupTitle(work);

  return {
    title,
    date,
    allDay,
    hasDate: !!(day || rel || rec),
    hasTime: !!(t || rel),
    recurrence: rec,
    priority,
    categoryId,
    newCategoryName,
    durationMin,
    matched,
  };
}

function weekdayOnly(matched: string[]): boolean {
  const re = new RegExp(`(${DAY_ANY_RE})`, 'iu');
  return matched.some((m) => re.test(m));
}

function cleanupTitle(masked: string): string {
  let s = masked.replace(/\u0000+/g, ' ');
  const dangling = /^(?:\s*(?:o|w|we|na|za|od|do|i|oraz|,|-|–|—|:)\s+)+/iu;
  const danglingEnd = /(?:\s+(?:o|w|we|na|za|od|do|i|oraz|,|-|–|—|:))+\s*$/iu;
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(dangling, '').replace(danglingEnd, '');
  s = s.replace(/^[,;:\-–—\s]+|[,;:\-–—\s]+$/g, '').replace(/\s+([,.!?])/g, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
