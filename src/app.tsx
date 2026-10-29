import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { statusCounts } from './digest/read.js';
import { mountDigest } from './digest/routes.js';
import { readNight } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) => {
    const status = readStatus(config);
    const nights = status.nights.map((night) => ({
      night,
      ...statusCounts(readNight(config.runsDir, night)),
    }));
    return c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={status} nights={nights} />
      </Layout>,
    );
  });

  mountDigest(app, config);
  return app;
}
