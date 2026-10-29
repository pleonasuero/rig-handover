// Types for the night digest. Logic lives in src/digest/; views only render these.

// Status of one run, as logged.
export type RunStatus = 'ok' | 'retry' | 'fail';

// One parsed line of runs/<night>.jsonl. `at` keeps the offset as logged.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  // Most recent error seen for the job, or null.
  lastError: string | null;
  // First and last run times, offset kept as logged.
  firstAt: string;
  lastAt: string;
};

// 'missing': no file for the night (404). 'night': file exists; rows [] means nothing ran.
// rows are sorted by job; badLines counts lines that failed to parse.
export type NightResult =
  | { kind: 'missing' }
  | { kind: 'night'; night: string; rows: DigestRow[]; badLines: number };

// Reads runs/<night>.jsonl from runsDir and builds the digest.
export type ReadNight = (runsDir: string, night: string) => NightResult;
