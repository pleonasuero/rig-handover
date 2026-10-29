import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage, NoNight } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const result = /^\d{4}-\d{2}-\d{2}$/.test(night) ? readNight(config.runsDir, night) : { kind: 'missing' as const };
    const title = `digest · ${night}`;
    if (result.kind === 'missing') {
      return c.html(
        <Layout title={title} lane={lane()}>
          <NoNight night={night} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={title} lane={lane()}>
        <DigestPage night={night} rows={result.rows} badLines={result.badLines} />
      </Layout>,
    );
  });

  return app;
}
