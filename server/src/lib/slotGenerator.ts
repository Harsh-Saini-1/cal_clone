import { addMinutes, parseISO } from 'date-fns';
import type { Availability, Booking, DateOverride, EventType } from '../types';

export interface TimeSlot {
  start_time: string; // ISO UTC string
  end_time: string;   // ISO UTC string
}

/**
 * Master slot generation function — v2
 *
 * Priority chain (highest → lowest):
 *   1. Date override: is_blocked=true  → return []
 *   2. Date override: custom hours     → use those hours only
 *   3. Weekly availability             → merge all active blocks
 *
 * After determining the time windows, slots are:
 *   - Generated at `duration`-minute intervals within each window
 *   - De-duplicated (in case of overlapping windows)
 *   - Sorted chronologically
 *   - Filtered to exclude already-confirmed bookings
 *
 * @param date          - UTC midnight of the requested day (Date object)
 * @param eventType     - The event type (contains `duration` in minutes)
 * @param availabilities- All availability rows for this event type (any day)
 *                        Filtering by day_of_week is done here.
 * @param overrides     - All date_override rows for this event type
 *                        Filtering by date is done here.
 * @param bookings      - Confirmed bookings for this event on this day
 */
export function generateAvailableSlots(
  date: Date,
  eventType: EventType,
  availabilities: Availability[],
  overrides: DateOverride[],
  bookings: Pick<Booking, 'start_time' | 'end_time'>[]
): TimeSlot[] {

  // ── Step 1: Check for a date override ──────────────────────
  const dateStr = formatDateUTC(date); // "YYYY-MM-DD"
  const override = overrides.find((o) => o.date === dateStr);

  let effectiveWindows: Array<{ start_time: string; end_time: string }>;

  if (override) {
    // Blocked → no slots at all
    if (override.is_blocked) return [];

    // Custom hours → use only those
    if (override.start_time && override.end_time) {
      effectiveWindows = [{
        start_time: override.start_time,
        end_time: override.end_time,
      }];
    } else {
      // Override exists but isn't blocked and has no custom times:
      // Fall through to weekly availability
      effectiveWindows = getWeeklyWindows(date, availabilities);
    }
  } else {
    // No override → use weekly availability
    effectiveWindows = getWeeklyWindows(date, availabilities);
  }

  // ── Step 2: Nothing configured for this day ─────────────────
  if (effectiveWindows.length === 0) return [];

  // ── Step 3: Generate raw slot timestamps ────────────────────
  // Use a Set of ISO strings to deduplicate in case windows overlap
  const slotStartSet = new Set<number>();
  const rawSlots: TimeSlot[] = [];

  for (const window of effectiveWindows) {
    const [startHour, startMin] = window.start_time.split(':').map(Number);
    const [endHour, endMin] = window.end_time.split(':').map(Number);

    const windowStart = buildUTCTime(date, startHour, startMin);
    const windowEnd   = buildUTCTime(date, endHour, endMin);

    let cursor = windowStart;

    while (true) {
      const slotEnd = addMinutes(cursor, eventType.duration);

      // Slot must fit entirely within the window (inclusive boundary)
      if (slotEnd.getTime() > windowEnd.getTime()) break;

      const startMs = cursor.getTime();
      if (!slotStartSet.has(startMs)) {
        slotStartSet.add(startMs);
        rawSlots.push({
          start_time: cursor.toISOString(),
          end_time: slotEnd.toISOString(),
        });
      }

      cursor = addMinutes(cursor, eventType.duration);
    }
  }

  // ── Step 4: Sort chronologically ────────────────────────────
  rawSlots.sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  // ── Step 5: Remove slots that conflict with existing bookings ─
  const bookedRanges = bookings.map((b) => ({
    start: parseISO(b.start_time),
    end: parseISO(b.end_time),
  }));

  return rawSlots.filter((slot) => {
    const slotStart = new Date(slot.start_time);
    const slotEnd   = new Date(slot.end_time);
    return !bookedRanges.some((b) => slotsOverlap(slotStart, slotEnd, b.start, b.end));
  });
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Filter availabilities down to active windows for the day-of-week
 * matching `date` (in UTC).
 */
function getWeeklyWindows(
  date: Date,
  availabilities: Availability[]
): Array<{ start_time: string; end_time: string }> {
  const dayOfWeek = date.getUTCDay(); // 0=Sun … 6=Sat
  return availabilities
    .filter((a) => a.day_of_week === dayOfWeek && a.is_active)
    .map((a) => ({ start_time: a.start_time, end_time: a.end_time }));
}

/**
 * Build a UTC Date for the given date + HH:MM.
 * Uses Date.UTC to avoid local-timezone contamination.
 */
function buildUTCTime(date: Date, hours: number, minutes: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hours,
      minutes,
      0,
      0
    )
  );
}

/**
 * Format a UTC Date as "YYYY-MM-DD" — matches the DATE column in Postgres.
 */
function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Half-open interval overlap: [aStart, aEnd) overlaps [bStart, bEnd)
 * when aStart < bEnd AND aEnd > bStart.
 * Touching boundaries (aEnd === bStart) is NOT an overlap.
 */
function slotsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}
