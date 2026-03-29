import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { supabase } from '../lib/supabase';
import { validate } from '../middleware/validate';
import { createHttpError } from '../middleware/errorHandler';
import type { CreateDateOverrideBody } from '../types';

const router = Router();

// ──────────────────────────────────────────────────────────────
// GET /overrides/:eventId
// Returns all date overrides for an event type
// ──────────────────────────────────────────────────────────────
router.get(
  '/:eventId',
  [
    param('eventId')
      .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('eventId must be a valid UUID'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId } = req.params;

      const { data, error } = await supabase
        .from('date_overrides')
        .select('*')
        .eq('event_type_id', eventId)
        .order('date', { ascending: true });

      if (error) throw createHttpError(error.message, 500);

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// POST /overrides
// Create or replace a date override for an event type + date.
// Uses upsert on (event_type_id, date) — one override per date.
// ──────────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('event_type_id')
      .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('event_type_id must be a valid UUID'),
    body('date')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('date must be YYYY-MM-DD'),
    body('is_blocked')
      .isBoolean()
      .withMessage('is_blocked must be a boolean'),
    body('start_time')
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('start_time must be HH:MM'),
    body('end_time')
      .optional()
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('end_time must be HH:MM'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        event_type_id,
        date,
        is_blocked,
        start_time,
        end_time,
      } = req.body as CreateDateOverrideBody;

      // Business-rule validation
      if (!is_blocked) {
        const hasStart = !!start_time;
        const hasEnd = !!end_time;

        if (hasStart !== hasEnd) {
          throw createHttpError('start_time and end_time must both be provided or both omitted.', 400);
        }

        if (hasStart && hasEnd && end_time! <= start_time!) {
          throw createHttpError('end_time must be after start_time.', 400);
        }
      }

      const row = {
        event_type_id,
        date,
        is_blocked,
        start_time: is_blocked ? null : (start_time ?? null),
        end_time:   is_blocked ? null : (end_time ?? null),
      };

      const { data, error } = await supabase
        .from('date_overrides')
        .upsert(row, { onConflict: 'event_type_id,date' })
        .select()
        .single();

      if (error) throw createHttpError(error.message, 500);

      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// DELETE /overrides/:id
// Remove a date override by its UUID (restores to weekly schedule)
// ──────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  [
    param('id')
      .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('id must be a valid UUID'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const { error } = await supabase
        .from('date_overrides')
        .delete()
        .eq('id', id);

      if (error) throw createHttpError(error.message, 500);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
