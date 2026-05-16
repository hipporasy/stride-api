import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { RedisStore } from 'connect-redis';
import { configurePassport } from '@/services/strava';
import { redisStoreClient } from '@/db/redis';
import { migrate } from '@/db/migrator';
import { errorHandler } from '@/middleware/errors';
import authRouter from '@/routes/auth';
import runsRouter from '@/routes/runs';
import mintRouter from '@/routes/mint';
import devRouter from '@/routes/dev';

async function main() {
  await migrate();

  configurePassport();

  const app = express();

  app.use(express.json());
  app.use(
    session({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store: new RedisStore({ client: redisStoreClient as any }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === 'production' },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.use('/auth', authRouter);
  app.use('/runs', runsRouter);
  app.use('/mint', mintRouter);
  app.get('/health', (_req, res) => res.json({ ok: true }));

  if (process.env.NODE_ENV !== 'production') {
    app.use('/dev', devRouter);
    console.log('Dev routes enabled: POST /dev/mint');
  }

  app.use(errorHandler);

  const port = process.env.PORT ?? 3001;
  app.listen(port, () => console.log(`stride-api listening on :${port}`));
}

main().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
