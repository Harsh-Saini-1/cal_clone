export interface EventType {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  slug: string;
  created_at: string;
}

export interface Availability {
  id: string;
  event_type_id: string;
  day_of_week: number;
  label: string;       // "Default", "Morning", "Evening" …
  start_time: string;  // "HH:MM:SS"
  end_time: string;    // "HH:MM:SS"
  is_active: boolean;
}

export interface DateOverride {
  id: string;
  event_type_id: string;
  date: string;            // "YYYY-MM-DD"
  is_blocked: boolean;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  event_type_id: string;
  name: string;
  email: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'rescheduled';
  rescheduled_from: string | null;
  created_at: string;
  event_types?: Pick<EventType, 'id' | 'title' | 'duration' | 'slug'>;
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
