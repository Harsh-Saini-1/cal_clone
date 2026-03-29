import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import eventsRouter from './routes/events';
import availabilityRouter from './routes/availability';
import slotsRouter from './routes/slots';
import bookingsRouter from './routes/bookings';
import overridesRouter from './routes/overrides';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';

// ── Security & Logging ────────────────────────────────────
app.use(helmet());
app.use(morgan('dev'));

// ── CORS ──────────────────────────────────────────────────
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Body Parsing ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────
app.use('/events', eventsRouter);
app.use('/availability', availabilityRouter);
app.use('/slots', slotsRouter);
app.use('/overrides', overridesRouter);

// Bookings router exposes both POST /book, POST /reschedule,
// and GET|DELETE /bookings/* — register at root.
app.use('/', bookingsRouter);

// ── 404 & Error Handlers (must be last) ──────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 CalClone server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   CORS: ${CLIENT_ORIGIN}\n`);
});

export default app;
