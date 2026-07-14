import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from '@/config';
import v1Router from '@/routes/v1/index';
import { errorHandler } from '@/middleware/errorHandler';

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  }),
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());

// ── API v1 routes ─────────────────────────────────────────────────────────────
app.use('/api/v1', v1Router);

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: "CampusOS API is running"
  });
});

export default app;
