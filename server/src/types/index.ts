/**
 * Shared TypeScript types matching the Supabase DB schema v2.
 */

export interface EventType {
  id: string;
  title: string;
  description: string | null;
  duration: number; // minutes
  slug: string;
  created_at: string;
}

export interface Availability {
  id: string;
  event_type_id: string;
  day_of_week: number; // 0=Sun … 6=Sat
  label: string;       // e.g. "Default", "Morning", "Evening"
  start_time: string;  // "HH:MM:SS" from Postgres TIME
  end_time: string;    // "HH:MM:SS"
  is_active: boolean;
}

export interface DateOverride {
  id: string;
  event_type_id: string;
  date: string;          // "YYYY-MM-DD"
  is_blocked: boolean;
  start_time: string | null;  // "HH:MM:SS" — null if purely blocked
  end_time: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  event_type_id: string;
  name: string;
  email: string;
  start_time: string;  // ISO UTC timestamptz
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'rescheduled';
  rescheduled_from: string | null;
  created_at: string;
}

// ─── Request body DTOs ───────────────────────────────────────

export interface CreateEventTypeBody {
  title: string;
  description?: string;
  duration: number;
  slug: string;
}

export interface UpdateEventTypeBody {
  title?: string;
  description?: string;
  duration?: number;
  slug?: string;
}

export interface AvailabilityWindow {
  day_of_week: number;
  label?: string;      // defaults to "Default" if omitted
  start_time: string;  // "HH:MM"
  end_time: string;    // "HH:MM"
  is_active?: boolean; // defaults to true
}

export interface SetAvailabilityBody {
  event_type_id: string;
  windows: AvailabilityWindow[];
}

export interface CreateBookingBody {
  event_type_id: string;
  name: string;
  email: string;
  start_time: string; // ISO UTC
}

export interface RescheduleBookingBody {
  booking_id: string;
  new_start_time: string; // ISO UTC
}

export interface CreateDateOverrideBody {
  event_type_id: string;
  date: string;           // "YYYY-MM-DD"
  is_blocked: boolean;
  start_time?: string;    // "HH:MM" — only if not blocked + custom hours
  end_time?: string;
}

// Standardised API response envelope
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
