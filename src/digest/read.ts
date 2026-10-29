// Reads runs/<night>.jsonl into one row per job. Bad lines are counted, never thrown.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies RunStatus[];

function isStatus(v: unknown): v is RunStatus {
  return typeof v === 'string' && STATUSES.includes(v);
}

// Parses one line, or returns null if it isn't a valid run line.
function parseLine(text: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || !isStatus(o.status)) return null;
  if (o.owner !== null && typeof o.owner !== 'string') return null;
  const line: RunLine = { at: o.at, job: o.job, status: o.status, owner: o.owner };
  if (typeof o.error === 'string') line.error = o.error;
  return line;
}

function readFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export const readNight: ReadNight = (runsDir, night) => {
  const text = readFile(join(runsDir, `${night}.jsonl`));
  if (text === null) return { kind: 'missing' };

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line === null) {
      badLines++;
      continue;
    }
    let row = byJob.get(line.job);
    if (row === undefined) {
      row = {
        job: line.job,
        owner: line.owner,
        runs: 0,
        retries: 0,
        fails: 0,
        lastStatus: line.status,
        lastError: null,
        firstAt: line.at,
        lastAt: line.at,
      };
      byJob.set(line.job, row);
    }
    row.runs++;
    if (line.status === 'retry') row.retries++;
    if (line.status === 'fail') row.fails++;
    row.owner = line.owner;
    row.lastStatus = line.status;
    row.lastAt = line.at;
    if (line.error !== undefined) row.lastError = line.error;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { kind: 'night', night, rows, badLines };
};
