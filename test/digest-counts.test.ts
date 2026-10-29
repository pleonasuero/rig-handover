import { describe, expect, it } from 'vitest';
import { countRows } from '../src/digest/counts.js';
import type { DigestRow } from '../src/digest/types.js';

const row = (over: Partial<DigestRow>): DigestRow => ({
  job: 'job/x',
  owner: null,
  runs: 0,
  retries: 0,
  fails: 0,
  lastStatus: 'ok',
  lastError: null,
  firstAt: '2026-10-28T00:00:00+01:00',
  lastAt: '2026-10-28T00:00:00+01:00',
  ...over,
});

describe('countRows', () => {
  it('is all zero for a night with no rows', () => {
    expect(countRows([])).toEqual({ ok: 0, retry: 0, fail: 0 });
  });

  it('sums retries and fails and takes ok as the rest of the runs', () => {
    const rows = [
      row({ job: 'a', runs: 4, retries: 3, fails: 0 }),
      row({ job: 'b', runs: 8, retries: 1, fails: 0 }),
      row({ job: 'c', runs: 1, retries: 0, fails: 1 }),
    ];
    expect(countRows(rows)).toEqual({ ok: 8, retry: 4, fail: 1 });
  });

  it('does not count a retry that also failed as ok', () => {
    expect(countRows([row({ runs: 3, retries: 1, fails: 1 })])).toEqual({ ok: 1, retry: 1, fail: 1 });
  });
});
