import { Router, Request, Response, NextFunction } from 'express';
import { query } from 'express-validator';
import { supabase } from '../lib/supabase';
import { validate } from '../middleware/validate';
import { createHttpError } from '../middleware/errorHandler';
import { generateAvailableSlots } from '../lib/slotGenerator';
import type { Availability, Booking, DateOverride, EventType } from '../types';

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /slots?eventId=<uuid>&date=<YYYY-MM-DD>
//
// Returns available non-booked slots for an event on a date.
// Priority: date override > weekly availability
// ─────────────────────────────────────────────────────────────
router.get(
  '/',
  [
    query('eventId')
      .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('eventId must be a valid UUID'),
    query('date')
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage('date must be YYYY-MM-DD'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { eventId, date } = req.query as { eventId: string; date: string };

      // 1. Fetch event type
      const { data: eventType, error: evErr } = await supabase
        .from('event_types')
        .select('*')
        .eq('id', eventId)
        .single<EventType>();

      if (evErr || !eventType) throw createHttpError('Event type not found.', 404);

      // 2. Parse date into UTC midnight
      const [year, month, day] = date.split('-').map(Number);
      const requestedDate = new Date(Date.UTC(year, month - 1, day));

      // 3. Fetch ALL availability rows for this event (all days)
      //    The slot generator filters by day_of_week internally.
      const { data: availabilityRows, error: availErr } = await supabase
        .from('availability')
        .select('*')
        .eq('event_type_id', eventId)
        .eq('is_active', true);

      if (availErr) throw createHttpError(availErr.message, 500);

      // 4. Fetch date overrides for this event
      const { data: overrideRows, error: overrideErr } = await supabase
        .from('date_overrides')
        .select('*')
        .eq('event_type_id', eventId);

      if (overrideErr) throw createHttpError(overrideErr.message, 500);

      // 5. Fetch confirmed bookings for this event on this date
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = new Date(Date.UTC(year, month - 1, day + 1)).toISOString();

      const { data: bookings, error: bookErr } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('event_type_id', eventId)
        .eq('status', 'confirmed')
        .gte('start_time', startOfDay)
        .lt('start_time', endOfDay);

      if (bookErr) throw createHttpError(bookErr.message, 500);

      // 6. Generate slots via the updated pure function
      const slots = generateAvailableSlots(
        requestedDate,
        eventType,
        (availabilityRows ?? []) as Availability[],
        (overrideRows ?? []) as DateOverride[],
        (bookings ?? []) as Pick<Booking, 'start_time' | 'end_time'>[]
      );

      return res.json({ success: true, data: slots });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
