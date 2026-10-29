import type { DigestRow } from './types.js';

// Night totals across job rows: ok = runs that were neither a retry nor a fail.
export type Counts = { ok: number; retry: number; fail: number };

export function countRows(rows: DigestRow[]): Counts {
  return rows.reduce<Counts>(
    (acc, r) => ({
      ok: acc.ok + (r.runs - r.retries - r.fails),
      retry: acc.retry + r.retries,
      fail: acc.fail + r.fails,
    }),
    { ok: 0, retry: 0, fail: 0 },
  );
}
