import type { CategoryColor, Priority } from './types';

export const CATEGORY_COLORS: Record<CategoryColor, { hex: string; label: string }> = {
  tomato: { hex: '#E5484D', label: 'Pomidorowy' },
  tangerine: { hex: '#F76B15', label: 'Mandarynkowy' },
  amber: { hex: '#E8A317', label: 'Bursztynowy' },
  lime: { hex: '#65A30D', label: 'Limonkowy' },
  emerald: { hex: '#10A37F', label: 'Szmaragdowy' },
  teal: { hex: '#0E9AAE', label: 'Morski' },
  sky: { hex: '#1E88E5', label: 'Niebieski' },
  indigo: { hex: '#5B5BD6', label: 'Indygo' },
  violet: { hex: '#8E4EC6', label: 'Fioletowy' },
  pink: { hex: '#D6409F', label: 'Różowy' },
  brown: { hex: '#A07553', label: 'Brązowy' },
  slate: { hex: '#64748B', label: 'Grafitowy' },
};

export const CATEGORY_COLOR_KEYS = Object.keys(CATEGORY_COLORS) as CategoryColor[];

/** Kolor wpisów bez kategorii. */
export const DEFAULT_EVENT_COLOR = '#4F6BF5';

export const PRIORITY_META: Record<Priority, { label: string; short: string; hex: string; rank: number }> = {
  high: { label: 'Wysoki', short: 'Wysoki', hex: '#E5484D', rank: 3 },
  medium: { label: 'Średni', short: 'Średni', hex: '#E8A317', rank: 2 },
  low: { label: 'Niski', short: 'Niski', hex: '#64748B', rank: 1 },
};

export function colorHex(color: CategoryColor | undefined | null): string {
  return color ? CATEGORY_COLORS[color]?.hex ?? DEFAULT_EVENT_COLOR : DEFAULT_EVENT_COLOR;
}
