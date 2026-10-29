import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-routes-'));
  // good night: two jobs, written out of order so sorting shows
  fs.writeFileSync(
    path.join(runsDir, '2026-01-01.jsonl'),
    [
      line('2026-01-01T23:00:00+01:00', 'lane/sync', 'ok', 'rook'),
      line('2026-01-01T23:10:00+01:00', 'a/first', 'ok', null),
      line('2026-01-01T23:20:00+01:00', 'lane/sync', 'fail', 'rook', 'lock held'),
    ].join('\n') + '\n',
  );
  fs.writeFileSync(path.join(runsDir, '2026-01-02.jsonl'), '');
  fs.writeFileSync(
    path.join(runsDir, '2026-01-03.jsonl'),
    [line('2026-01-03T23:00:00+01:00', 'lane/sync', 'ok', 'rook'), '{"at":"2026-01-03T23:10:00+01:00","jo'].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  fs.rmSync(runsDir, { recursive: true, force: true });
});

type Json = { night: string; rows: { job: string }[]; badLines: number };

describe('digest page', () => {
  it('renders a good night', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-01-01');
    expect(html).toContain('lane/sync');
    expect(html).toContain('a/first');
  });

  it('404s with the layout for a night with no file', async () => {
    const res = await app.request('/digest/2026-02-02');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no runs for 2026-02-02');
  });

  it('404s for a bad night format', async () => {
    expect((await app.request('/digest/..%2Fsecret')).status).toBe(404);
    expect((await app.request('/digest/not-a-date')).status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-01-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
  });

  it('keeps rows and notes the bad line', async () => {
    const res = await app.request('/digest/2026-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).toContain("1 line(s) didn't parse");
  });
});

describe('digest json', () => {
  it('returns rows for a good night', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    const body = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(body.night).toBe('2026-01-01');
    expect(body.rows.map((r) => r.job)).toEqual(['a/first', 'lane/sync']);
    expect(body.badLines).toBe(0);
  });

  it('404s with the error shape for a missing night', async () => {
    const res = await app.request('/api/digest/2026-02-02');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no runs for 2026-02-02', night: '2026-02-02' });
  });

  it('404s with the same shape for a bad night format', async () => {
    const res = await app.request('/api/digest/not-a-date');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no runs for not-a-date', night: 'not-a-date' });
  });

  it('returns an empty rows list for an empty night', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('keeps rows and counts the bad line', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    const body = (await res.json()) as Json;
    expect(res.status).toBe(200);
    expect(body.rows.length).toBe(1);
    expect(body.badLines).toBe(1);
  });
});

describe('page and json agree', () => {
  it('list jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as Json;
    const jobs = body.rows.map((r) => r.job);
    expect(jobs.length).toBe(2);
    const positions = jobs.map((j) => html.indexOf(j));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
