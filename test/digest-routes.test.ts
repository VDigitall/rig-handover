import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

function appAt(runsDir: string) {
  const config: RigConfig = {
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  };
  return createApp(config);
}

function nightFile(dir: string, night: string, body: string) {
  writeFileSync(join(dir, `${night}.jsonl`), body);
}

describe('digest routes', () => {
  it('renders 2026-10-28 and returns the same jobs from JSON', async () => {
    const app = appAt('runs');
    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    const html = await page.text();
    const body = (await json.json()) as { rows: { job: string }[]; badLines: number };
    const jobs = [...html.matchAll(/data-job="([^"]+)"/g)].map((match) => match[1]);
    expect(jobs).toEqual(body.rows.map((row) => row.job));
    expect(body.badLines).toBe(1);
    expect(html).toContain('data-job="fixtures/refresh"');
    expect(html).toContain('data-job="notes/backup"');
    expect(html).toMatch(/class="warn"[^>]*data-job="fixtures\/refresh"|data-job="fixtures\/refresh"[^>]*class="warn"/);
    expect(html).toMatch(/class="warn"[^>]*data-job="notes\/backup"|data-job="notes\/backup"[^>]*class="warn"/);
    expect(html).not.toMatch(/class="warn"[^>]*data-job="digest\/render"|data-job="digest\/render"[^>]*class="warn"/);
    expect(html).toContain('—');
  });

  it('returns 404 when the night file is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    const app = appAt(dir);
    const page = await app.request('/digest/2026-10-02');
    const json = await app.request('/api/digest/2026-10-02');
    expect(page.status).toBe(404);
    expect(json.status).toBe(404);
  });

  it('renders nothing ran for an empty night', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    nightFile(dir, '2026-10-03', '');
    const app = appAt(dir);
    const page = await app.request('/digest/2026-10-03');
    const json = await app.request('/api/digest/2026-10-03');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    expect(await json.json()).toEqual({ rows: [], badLines: 0 });
  });

  it('renders a night that contains a bad line', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    nightFile(
      dir,
      '2026-10-04',
      '{"at":"2026-10-04T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}\nnot-json\n',
    );
    const app = appAt(dir);
    const page = await app.request('/digest/2026-10-04');
    const json = await app.request('/api/digest/2026-10-04');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('lane/sync');
    const body = (await json.json()) as { rows: { job: string }[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((row) => row.job)).toEqual(['lane/sync']);
  });
});

describe('status board digest links', () => {
  it('links both nights on disk to a digest that renders', async () => {
    const app = appAt('runs');
    const board = await app.request('/');
    const html = await board.text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('ok /');
    for (const night of ['2026-10-28', '2026-10-27']) {
      const page = await app.request(`/digest/${night}`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain(night === '2026-10-28' ? 'digest/render' : 'lane/sync');
    }
  });
});
