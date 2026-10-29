import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, DigestStatus, NightDigest } from './types.js';

type Event = {
  at: string;
  instant: number;
  order: number;
  job: string;
  status: DigestStatus;
  owner: string | null;
  error: string | null;
};

const DIGEST_STATUS: Record<DigestStatus, true> = {
  ok: true,
  retry: true,
  fail: true,
};

function isDigestStatus(value: string): value is DigestStatus {
  return Object.hasOwn(DIGEST_STATUS, value);
}

function parseLine(line: string, order: number): Event | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const { at, job, status, owner, error } = record;
  if (typeof at !== 'string' || typeof job !== 'string' || job === '') return null;
  if (typeof status !== 'string' || !isDigestStatus(status)) return null;
  const instant = Date.parse(at);
  if (Number.isNaN(instant)) return null;
  if (owner !== undefined && owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  return {
    at,
    instant,
    order,
    job,
    status,
    owner: typeof owner === 'string' ? owner : null,
    error: typeof error === 'string' ? error : null,
  };
}

function later(a: Event, b: Event): Event {
  if (a.instant !== b.instant) return a.instant > b.instant ? a : b;
  return a.order > b.order ? a : b;
}

export function readNightFromDisk(runsDir: string, night: string): NightDigest {
  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  if (text.length === 0) return { rows: [], badLines: 0 };

  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();

  let badLines = 0;
  const byJob = new Map<string, Event[]>();
  lines.forEach((line, order) => {
    const event = parseLine(line, order);
    if (!event) {
      badLines += 1;
      return;
    }
    const group = byJob.get(event.job);
    if (group) group.push(event);
    else byJob.set(event.job, [event]);
  });

  const rows: DigestRow[] = [];
  for (const [job, events] of byJob) {
    let first = events[0];
    let last = events[0];
    let lastError: Event | null = null;
    let retries = 0;
    let fails = 0;
    for (const event of events) {
      if (event.instant < first.instant || (event.instant === first.instant && event.order < first.order)) first = event;
      last = later(last, event);
      if (event.status === 'retry') retries += 1;
      if (event.status === 'fail') fails += 1;
      if (event.error !== null && (lastError === null || later(event, lastError) === event)) lastError = event;
    }
    rows.push({
      job,
      owner: last.owner,
      runs: events.length,
      retries,
      fails,
      lastStatus: last.status,
      lastError: lastError?.error ?? null,
      firstAt: first.at,
      lastAt: last.at,
    });
  }

  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
}

export function statusCounts(digest: NightDigest): { ok: number; retry: number; fail: number } {
  const counts = { ok: 0, retry: 0, fail: 0 };
  for (const row of digest.rows) {
    counts.retry += row.retries;
    counts.fail += row.fails;
    counts.ok += row.runs - row.retries - row.fails;
  }
  return counts;
}
