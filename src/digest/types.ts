// The row every digest view shares. Times stay as written in the log, offset included.

import { readNightFromDisk } from './read.js';

export type DigestStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  fails: number;
  lastStatus: DigestStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  rows: DigestRow[];
  badLines: number;
};

export function readNight(runsDir: string, night: string): NightDigest {
  return readNightFromDisk(runsDir, night);
}
