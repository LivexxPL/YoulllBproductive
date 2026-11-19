import type { Occurrence } from '../../lib/types';

export interface Placed {
  occ: Occurrence;
  startMin: number;
  endMin: number;
  col: number;
  cols: number;
}

/** Minimalna „wizualna” długość wpisu – żeby punktowe przypomnienia dało się kliknąć. */
export const MIN_VISUAL_MIN = 25;

/**
 * Rozkład nachodzących na siebie wpisów w kolumnie dnia
 * (klasyczny algorytm: klastry + zachłanne przydzielanie kolumn).
 */
export function layoutDay(items: Occurrence[], dayStart: Date): Placed[] {
  const base = dayStart.getTime();
  const rows = items
    .map((occ) => {
      const startMin = Math.max(0, Math.round((occ.start.getTime() - base) / 60000));
      const rawEnd = Math.round((occ.end.getTime() - base) / 60000);
      const endMin = Math.min(24 * 60, Math.max(rawEnd, startMin + MIN_VISUAL_MIN));
      return { occ, startMin, endMin, col: 0, cols: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let colsEnd: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const n = colsEnd.length;
    for (const p of cluster) p.cols = n;
    out.push(...cluster);
    cluster = [];
    colsEnd = [];
  };

  for (const r of rows) {
    if (r.startMin >= clusterEnd && cluster.length) flush();
    let col = colsEnd.findIndex((end) => end <= r.startMin);
    if (col === -1) {
      col = colsEnd.length;
      colsEnd.push(r.endMin);
    } else colsEnd[col] = r.endMin;
    r.col = col;
    cluster.push(r);
    clusterEnd = Math.max(clusterEnd, r.endMin);
  }
  if (cluster.length) flush();
  return out;
}

export const snap = (min: number, step = 15) => Math.round(min / step) * step;
