import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const result = readNight('runs', '2026-10-28');
  if (result.kind !== 'night') throw new Error('expected a night');
  const byJob = new Map(result.rows.map((r) => [r.job, r]));

  it('has 5 jobs sorted by job and 1 bad line', () => {
    expect(result.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(result.badLines).toBe(1);
  });

  it('keeps a null owner', () => {
    expect(byJob.get('digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok', lastError: null });
  });

  it('counts retries and keeps the last error after a recovery', () => {
    expect(byJob.get('fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      fails: 0,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(byJob.get('lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: 'lock held',
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });

  it('counts a fail', () => {
    expect(byJob.get('notes/backup')).toMatchObject({
      owner: 'lane-07',
      runs: 1,
      fails: 1,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('totals ok 10 · retry 4 · fail 1', () => {
    const retry = result.rows.reduce((n, r) => n + r.retries, 0);
    const fail = result.rows.reduce((n, r) => n + r.fails, 0);
    const ok = result.rows.reduce((n, r) => n + r.runs - r.retries - r.fails, 0);
    expect({ ok, retry, fail }).toEqual({ ok: 10, retry: 4, fail: 1 });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-read-'));

  it('returns missing when there is no file', () => {
    expect(readNight(dir, '2026-01-01')).toEqual({ kind: 'missing' });
  });

  it('returns no rows for an empty file', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ kind: 'night', night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts bad lines and skips blank ones', () => {
    const lines = [
      '{"at":"2026-01-03T01:00:00+01:00","job":"b","status":"ok","owner":"x"}',
      '',
      '   ',
      'not json',
      '{"at":"2026-01-03T02:00:00+01:00","job":"a","status":"nope","owner":"x"}',
      '{"at":"2026-01-03T03:00:00+01:00","job":"a","status":"ok","owner":5}',
      '{"at":"2026-01-03T04:00:00+01:00","job":"a","status":"fail","owner":null,"error":"boom"}',
    ];
    writeFileSync(join(dir, '2026-01-03.jsonl'), lines.join('\n') + '\n');
    const result = readNight(dir, '2026-01-03');
    if (result.kind !== 'night') throw new Error('expected a night');
    expect(result.badLines).toBe(3);
    expect(result.rows.map((r) => r.job)).toEqual(['a', 'b']);
    expect(result.rows[0]).toMatchObject({ owner: null, fails: 1, lastError: 'boom' });
  });
});
