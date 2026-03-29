import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { supabase } from '../lib/supabase';
import { validate } from '../middleware/validate';
import { createHttpError } from '../middleware/errorHandler';
import type { CreateEventTypeBody, UpdateEventTypeBody } from '../types';

const router = Router();

// ──────────────────────────────────────────
// GET /events  — list all event types
// ──────────────────────────────────────────
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('event_types')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw createHttpError(error.message, 500);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────
// POST /events  — create a new event type
// ──────────────────────────────────────────
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('duration')
      .isInt({ min: 1 })
      .withMessage('Duration must be a positive integer (minutes)'),
    body('slug')
      .trim()
      .notEmpty()
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug must be lowercase alphanumeric with hyphens only'),
    body('description').optional().isString(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as CreateEventTypeBody;

      const { data, error } = await supabase
        .from('event_types')
        .insert({
          title: body.title,
          description: body.description ?? null,
          duration: body.duration,
          slug: body.slug,
        })
        .select()
        .single();

      if (error) {
        // Unique violation on slug
        if (error.code === '23505') {
          throw createHttpError(`Slug "${body.slug}" is already taken.`, 409);
        }
        throw createHttpError(error.message, 500);
      }

      res.status(201).json({ success: true, data });

      // Auto-create default availability: Mon–Sat 09:00–17:00
      // Fire-and-forget so it doesn't block the response
      const defaultWindows = [1, 2, 3, 4, 5, 6].map((day) => ({
        event_type_id: data.id,
        day_of_week: day,
        start_time: '09:00',
        end_time: '17:00',
      }));
      supabase.from('availability').insert(defaultWindows).then(() => {});
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────
// GET /events/by-slug/:slug  — public lookup
// Used by the public booking page
// ──────────────────────────────────────────
router.get(
  '/by-slug/:slug',
  [param('slug').matches(/^[a-z0-9-]+$/).withMessage('Invalid slug format')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params;
      const { data, error } = await supabase
        .from('event_types')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error || !data) throw createHttpError('Event not found.', 404);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────
// PUT /events/:id  — update an event type
// ──────────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('Event ID must be a valid UUID'),
    body('title').optional().trim().notEmpty(),
    body('duration').optional().isInt({ min: 1 }),
    body('slug')
      .optional()
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug must be lowercase alphanumeric with hyphens only'),
    body('description').optional().isString(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updates = req.body as UpdateEventTypeBody;

      // Remove undefined keys so we don't overwrite with null unintentionally
      const payload = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined)
      );

      if (Object.keys(payload).length === 0) {
        throw createHttpError('No fields provided for update.', 400);
      }

      const { data, error } = await supabase
        .from('event_types')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw createHttpError('Slug is already taken.', 409);
        }
        throw createHttpError(error.message, 500);
      }

      if (!data) throw createHttpError('Event type not found.', 404);

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────
// DELETE /events/:id  — delete an event type
// ──────────────────────────────────────────
router.delete(
  '/:id',
  [param('id').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('Event ID must be a valid UUID')],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const { error, count } = await supabase
        .from('event_types')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (error) throw createHttpError(error.message, 500);
      if (count === 0) throw createHttpError('Event type not found.', 404);

      res.json({ success: true, data: { id } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
