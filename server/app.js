import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { sessionMiddleware } from './auth/session.js';
import authRoutes from './auth/routes.js';

export function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }
  app.use(sessionMiddleware());

  app.get('/health', (_req, res) => res.json({ ok: true, uptime_s: process.uptime() }));
  app.use('/api/auth', authRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  });
  return app;
}
