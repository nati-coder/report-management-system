import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import env from './config/env.js';
import passport from './config/passport.js';
import { pool } from './config/db.js';
import apiRouter from './src/routes/index.js';
import { errorHandler, notFound } from './src/middlewares/errorHandler.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin(origin, cb) {
    // allow same-origin / server-to-server (no Origin header) and whitelisted origins only
    if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
if (!env.isProd) app.use(morgan('dev'));
app.use(passport.initialize());

app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.PORT, () => console.log(`RMS API listening on :${env.PORT} (${env.NODE_ENV})`));

const shutdown = (sig) => {
  console.log(`${sig} received, shutting down`);
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
};
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));

export default app;
