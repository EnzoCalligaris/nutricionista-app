/**
 * Intervalos meio-abertos [start, end) em milissegundos desde a época —
 * mesma semântica da exclusion constraint do banco (`tstzrange(..., '[)')`):
 * 10:00–11:00 e 11:00–12:00 NÃO se sobrepõem; 10:00–11:00 e 10:30–11:30 sim.
 */
export type Interval = { start: number; end: number };

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function isAdjacent(a: Interval, b: Interval): boolean {
  return a.end === b.start || b.end === a.start;
}

export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

/** Ordena e funde intervalos que se sobrepõem ou são adjacentes. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals]
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

/** Subtrai `busy` de `free`, devolvendo os pedaços livres restantes. */
export function subtractIntervals(free: Interval[], busy: Interval[]): Interval[] {
  const blockers = mergeIntervals(busy);
  const result: Interval[] = [];
  for (const window of mergeIntervals(free)) {
    let cursor = window.start;
    for (const blocker of blockers) {
      if (blocker.end <= cursor || blocker.start >= window.end) continue;
      if (blocker.start > cursor) result.push({ start: cursor, end: blocker.start });
      cursor = Math.max(cursor, blocker.end);
      if (cursor >= window.end) break;
    }
    if (cursor < window.end) result.push({ start: cursor, end: window.end });
  }
  return result;
}
