import type { EventType, Availability, Booking, DateOverride, TimeSlot, ApiResponse } from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.success || !res.ok) {
    throw new Error((json as any).error ?? 'Request failed');
  }
  return json.data as T;
}

// ── Event Types ───────────────────────────────────────────────
export const getEvents = () => request<EventType[]>('/events');

export const getEventBySlug = (slug: string) =>
  request<EventType>(`/events/by-slug/${slug}`);

export const createEvent = (body: {
  title: string; description?: string; duration: number; slug: string;
}) => request<EventType>('/events', { method: 'POST', body: JSON.stringify(body) });

export const updateEvent = (id: string, body: Partial<EventType>) =>
  request<EventType>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const deleteEvent = (id: string) =>
  request<{ id: string }>(`/events/${id}`, { method: 'DELETE' });

// ── Availability ──────────────────────────────────────────────
export const getAvailability = (eventId: string) =>
  request<Availability[]>(`/availability/${eventId}`);

// Replace-all: sends complete desired state
export const setAvailability = (body: {
  event_type_id: string;
  windows: Array<{
    day_of_week: number;
    label?: string;
    start_time: string;
    end_time: string;
    is_active?: boolean;
  }>;
}) =>
  request<Availability[]>('/availability', {
    method: 'POST',
    body: JSON.stringify(body),
  });

// Toggle is_active or update label/times on a single window
export const patchAvailability = (
  id: string,
  updates: Partial<{ label: string; is_active: boolean; start_time: string; end_time: string }>
) =>
  request<Availability>(`/availability/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });

// Delete a single availability window by its UUID
export const deleteAvailabilityWindow = (id: string) =>
  request<void>(`/availability/${id}`, { method: 'DELETE' });

// ── Date Overrides ────────────────────────────────────────────
export const getOverrides = (eventId: string) =>
  request<DateOverride[]>(`/overrides/${eventId}`);

export const upsertOverride = (body: {
  event_type_id: string;
  date: string;
  is_blocked: boolean;
  start_time?: string;
  end_time?: string;
}) =>
  request<DateOverride>('/overrides', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const deleteOverride = (id: string) =>
  request<void>(`/overrides/${id}`, { method: 'DELETE' });

// ── Slots ─────────────────────────────────────────────────────
export const getSlots = (eventId: string, date: string) =>
  request<TimeSlot[]>(`/slots?eventId=${eventId}&date=${date}`);

// ── Bookings ──────────────────────────────────────────────────
export const createBooking = (body: {
  event_type_id: string; name: string; email: string; start_time: string;
}) =>
  request<Booking>('/book', { method: 'POST', body: JSON.stringify(body) });

export const rescheduleBooking = (body: {
  booking_id: string;
  new_start_time: string;
}) =>
  request<{ new_booking: Booking; rescheduled_booking_id: string }>(
    '/reschedule',
    { method: 'POST', body: JSON.stringify(body) }
  );

export const getBookings = () => request<Booking[]>('/bookings');

export const cancelBooking = (id: string) =>
  request<Booking>(`/bookings/${id}`, { method: 'DELETE' });
