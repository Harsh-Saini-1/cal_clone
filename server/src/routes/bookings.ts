import { Router, Request, Response, NextFunction } from 'express';
import { body, param } from 'express-validator';
import { supabase } from '../lib/supabase';
import { validate } from '../middleware/validate';
import { createHttpError } from '../middleware/errorHandler';
import { generateAvailableSlots } from '../lib/slotGenerator';
import { parseISO, isValid } from 'date-fns';
import type { Availability, Booking, DateOverride, EventType } from '../types';

const router = Router();

// ── Shared helper: load everything needed to validate a slot ──
async function loadSlotContext(
  event_type_id: string,
  startDate: Date
): Promise<{
  eventType: EventType;
  availabilities: Availability[];
  overrides: DateOverride[];
  bookings: Pick<Booking, 'start_time' | 'end_time'>[];
}> {
  const [year, month, day] = [
    startDate.getUTCFullYear(),
    startDate.getUTCMonth() + 1,
    startDate.getUTCDate(),
  ];

  const [evResult, availResult, overrideResult] = await Promise.all([
    supabase.from('event_types').select('*').eq('id', event_type_id).single<EventType>(),
    supabase.from('availability').select('*').eq('event_type_id', event_type_id).eq('is_active', true),
    supabase.from('date_overrides').select('*').eq('event_type_id', event_type_id),
  ]);

  if (evResult.error || !evResult.data) throw createHttpError('Event type not found.', 404);
  if (availResult.error) throw createHttpError(availResult.error.message, 500);
  if (overrideResult.error) throw createHttpError(overrideResult.error.message, 500);

  const startOfDay = new Date(Date.UTC(year, month - 1, day)).toISOString();
  const endOfDay   = new Date(Date.UTC(year, month - 1, day + 1)).toISOString();

  const bookResult = await supabase
    .from('bookings')
    .select('start_time, end_time')
    .eq('event_type_id', event_type_id)
    .eq('status', 'confirmed')
    .gte('start_time', startOfDay)
    .lt('start_time', endOfDay);

  if (bookResult.error) throw createHttpError(bookResult.error.message, 500);

  return {
    eventType: evResult.data,
    availabilities: (availResult.data ?? []) as Availability[],
    overrides: (overrideResult.data ?? []) as DateOverride[],
    bookings: (bookResult.data ?? []) as Pick<Booking, 'start_time' | 'end_time'>[],
  };
}

// ──────────────────────────────────────────────────────────────
// POST /book  — create a booking
// ──────────────────────────────────────────────────────────────
router.post(
  '/book',
  [
    body('event_type_id')
      .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('event_type_id must be a UUID'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('A valid email is required'),
    body('start_time').isISO8601().withMessage('start_time must be ISO 8601 UTC'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { event_type_id, name, email, start_time } = req.body as {
        event_type_id: string; name: string; email: string; start_time: string;
      };

      const startDate = parseISO(start_time);
      if (!isValid(startDate)) throw createHttpError('Invalid start_time.', 400);
      if (startDate < new Date()) throw createHttpError('Cannot book a slot in the past.', 400);

      const { eventType, availabilities, overrides, bookings } =
        await loadSlotContext(event_type_id, startDate);

      const requestedDate = new Date(Date.UTC(
        startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()
      ));

      const validSlots = generateAvailableSlots(
        requestedDate, eventType, availabilities, overrides, bookings
      );

      const slotExists = validSlots.some(
        (s) => new Date(s.start_time).getTime() === startDate.getTime()
      );

      if (!slotExists) {
        throw createHttpError(
          'The requested slot is not available. It may already be booked or outside availability.',
          409
        );
      }

      const endDate = new Date(startDate.getTime() + eventType.duration * 60_000);

      const { data: booking, error: insertError } = await supabase
        .from('bookings')
        .insert({ event_type_id, name, email, start_time: startDate.toISOString(), end_time: endDate.toISOString(), status: 'confirmed' })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          throw createHttpError('This slot was just booked by someone else. Please choose another.', 409);
        }
        throw createHttpError(insertError.message, 500);
      }

      res.status(201).json({ success: true, data: booking });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// POST /reschedule
// Safely reschedule a booking:
//   1. Verify old booking exists and is confirmed
//   2. Validate new slot is available (same rules as /book)
//   3. Create NEW booking with rescheduled_from = old booking id
//   4. Mark old booking status = 'rescheduled'
// All within a logical transaction (two atomic Supabase calls).
// ──────────────────────────────────────────────────────────────
router.post(
  '/reschedule',
  [
    body('booking_id')
      .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('booking_id must be a UUID'),
    body('new_start_time').isISO8601().withMessage('new_start_time must be ISO 8601 UTC'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { booking_id, new_start_time } = req.body as {
        booking_id: string;
        new_start_time: string;
      };

      const newStartDate = parseISO(new_start_time);
      if (!isValid(newStartDate)) throw createHttpError('Invalid new_start_time.', 400);
      if (newStartDate < new Date()) throw createHttpError('Cannot reschedule to a past slot.', 400);

      // 1. Fetch the original booking
      const { data: oldBooking, error: fetchErr } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', booking_id)
        .single<Booking>();

      if (fetchErr || !oldBooking) throw createHttpError('Booking not found.', 404);
      if (oldBooking.status !== 'confirmed') {
        throw createHttpError(
          `Cannot reschedule a booking with status "${oldBooking.status}".`,
          400
        );
      }

      // 2. Load slot context for the NEW date, excluding the old booking
      //    from the confirmed list so its slot counts as free.
      const { eventType, availabilities, overrides } =
        await loadSlotContext(oldBooking.event_type_id, newStartDate);

      // Fetch confirmed bookings for the new date, explicitly excluding the old booking
      const newDateStr = new_start_time.substring(0, 10);
      const [year, month, day] = newDateStr.split('-').map(Number);
      const startOfDay = new Date(Date.UTC(year, month - 1, day)).toISOString();
      const endOfDay   = new Date(Date.UTC(year, month - 1, day + 1)).toISOString();

      const { data: newDayBookings, error: bookErr } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('event_type_id', oldBooking.event_type_id)
        .eq('status', 'confirmed')
        .neq('id', booking_id)   // exclude the booking being rescheduled
        .gte('start_time', startOfDay)
        .lt('start_time', endOfDay);

      if (bookErr) throw createHttpError(bookErr.message, 500);

      const requestedDate = new Date(Date.UTC(year, month - 1, day));
      const validSlots = generateAvailableSlots(
        requestedDate,
        eventType,
        availabilities,
        overrides,
        (newDayBookings ?? []) as Pick<Booking, 'start_time' | 'end_time'>[]
      );

      const slotExists = validSlots.some(
        (s) => new Date(s.start_time).getTime() === newStartDate.getTime()
      );

      if (!slotExists) {
        throw createHttpError(
          'The requested slot is not available for rescheduling.',
          409
        );
      }

      // 3. Create new booking (rescheduled_from → old booking id)
      const newEndDate = new Date(newStartDate.getTime() + eventType.duration * 60_000);

      const { data: newBooking, error: insertErr } = await supabase
        .from('bookings')
        .insert({
          event_type_id: oldBooking.event_type_id,
          name: oldBooking.name,
          email: oldBooking.email,
          start_time: newStartDate.toISOString(),
          end_time: newEndDate.toISOString(),
          status: 'confirmed',
          rescheduled_from: booking_id,
        })
        .select()
        .single();

      if (insertErr) {
        if (insertErr.code === '23505') {
          throw createHttpError('This slot was just booked by someone else.', 409);
        }
        throw createHttpError(insertErr.message, 500);
      }

      // 4. Mark old booking as rescheduled (NOT deleted — history preserved)
      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ status: 'rescheduled' })
        .eq('id', booking_id);

      if (updateErr) {
        // New booking was created but old wasn't marked — log, but don't fail the user
        console.error('[reschedule] Failed to mark old booking as rescheduled:', updateErr.message);
      }

      res.status(201).json({
        success: true,
        data: {
          new_booking: newBooking,
          rescheduled_booking_id: booking_id,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// GET /bookings  — list all bookings (dashboard)
// ──────────────────────────────────────────────────────────────
router.get(
  '/bookings',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, event_types (id, title, duration, slug)`)
        .order('start_time', { ascending: true });

      if (error) throw createHttpError(error.message, 500);

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ──────────────────────────────────────────────────────────────
// DELETE /bookings/:id  — cancel a booking (soft-cancel)
// ──────────────────────────────────────────────────────────────
router.delete(
  '/bookings/:id',
  [
    param('id')
      .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      .withMessage('Booking ID must be a valid UUID'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw createHttpError(error.message, 500);
      if (!data) throw createHttpError('Booking not found.', 404);

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
