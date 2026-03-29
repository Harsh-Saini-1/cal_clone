import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { supabase } from '../lib/supabase';
import { validate } from '../middleware/validate';
import { createHttpError } from '../middleware/errorHandler';
import type { AvailabilityWindow } from '../types';

const router = Router();

// ──────────────────────────────────────────────────────────────
// GET /availability/:eventId
// Returns all availability windows for an event (all days, all labels)
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
        .from('availability')
        .select('*')
        .eq('event_type_id', eventId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw createHttpError(error.message, 500);

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// POST /availability
// Replace all availability windows for an event type.
//
// Strategy:
//   1. Delete ALL existing windows for this event_type_id
//   2. Insert fresh rows from the request body
//
// This is simpler than per-row upsert and avoids stale label conflicts.
// The client always sends the complete desired state.
// ──────────────────────────────────────────────────────────────
router.post(
  '/',
  [
    body('event_type_id')
      .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('event_type_id must be a valid UUID'),
    body('windows')
      .isArray({ min: 0 })
      .withMessage('windows must be an array (can be empty to clear all)'),
    body('windows.*.day_of_week')
      .isInt({ min: 0, max: 6 })
      .withMessage('day_of_week must be 0–6'),
    body('windows.*.start_time')
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('start_time must be HH:MM'),
    body('windows.*.end_time')
      .matches(/^\d{2}:\d{2}$/)
      .withMessage('end_time must be HH:MM'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { event_type_id, windows } = req.body as {
        event_type_id: string;
        windows: AvailabilityWindow[];
      };

      // Validate time order for each window
      for (const w of windows) {
        if (w.end_time <= w.start_time) {
          throw createHttpError(
            `Window (day ${w.day_of_week}, label "${w.label ?? 'Default'}"): end_time must be after start_time.`,
            400
          );
        }
      }

      // Delete all existing windows for this event
      const { error: delError } = await supabase
        .from('availability')
        .delete()
        .eq('event_type_id', event_type_id);

      if (delError) throw createHttpError(delError.message, 500);

      // If the request is "clear all", we're done
      if (windows.length === 0) {
        return res.json({ success: true, data: [] });
      }

      // Build rows with defaults applied
      const rows = windows.map((w) => ({
        event_type_id,
        day_of_week: w.day_of_week,
        label: w.label ?? 'Default',
        start_time: w.start_time,
        end_time: w.end_time,
        is_active: w.is_active !== undefined ? w.is_active : true,
      }));

      const { data, error: insertError } = await supabase
        .from('availability')
        .insert(rows)
        .select();

      if (insertError) throw createHttpError(insertError.message, 500);

      return res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// PATCH /availability/:id
// Toggle is_active or update label/times for a single window
// ──────────────────────────────────────────────────────────────
router.patch(
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
      const updates: Record<string, unknown> = {};

      if (req.body.label !== undefined) updates.label = String(req.body.label).trim();
      if (req.body.is_active !== undefined) updates.is_active = Boolean(req.body.is_active);
      if (req.body.start_time !== undefined) updates.start_time = req.body.start_time;
      if (req.body.end_time !== undefined) updates.end_time = req.body.end_time;

      if (Object.keys(updates).length === 0) {
        throw createHttpError('No valid fields to update.', 400);
      }

      const { data, error } = await supabase
        .from('availability')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw createHttpError(error.message, 500);
      if (!data) throw createHttpError('Availability window not found.', 404);

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// DELETE /availability/:id
// Remove a single availability window by its UUID
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
        .from('availability')
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
