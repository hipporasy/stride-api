import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { configurePassport } from './services/strava';
import authRouter from './routes/auth';
import runsRouter from './routes/runs';
import mintRouter from './routes/mint';
import devRouter from './routes/dev';

configurePassport();

const app = express();

app.use(express.json());
app.use(
  session({
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

const port = process.env.PORT ?? 3001;
app.listen(port, () => console.log(`stride-api listening on :${port}`));
