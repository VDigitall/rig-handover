import type { Hono } from 'hono';
import type { RigConfig } from '../config.js';
import { lane } from '../lane.js';
import { Layout } from '../views/layout.js';
import { DigestPage } from '../views/digest.js';
import { readNight } from './types.js';

export function mountDigest(app: Hono, config: RigConfig) {
  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    try {
      const digest = readNight(config.runsDir, night);
      return c.html(
        <Layout title={`digest ${night}`} lane={lane()}>
          <DigestPage digest={digest} />
        </Layout>,
      );
    } catch (err) {
      if (!(typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT')) throw err;
      return c.html(
        <Layout title="digest" lane={lane()}>
          <p>no such night</p>
        </Layout>,
        404,
      );
    }
  });

  app.get('/api/digest/:night', (c) => {
    try {
      return c.json(readNight(config.runsDir, c.req.param('night')));
    } catch (err) {
      if (!(typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT')) throw err;
      return c.json({ error: 'no such night' }, 404);
    }
  });
}
