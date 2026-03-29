-- =============================================================
-- CalClone - Supabase PostgreSQL Schema
-- Version: 2.0
-- All timestamps stored in UTC
-- Features: Multi-block availability, Date overrides, Reschedule
-- =============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================
-- TABLE: event_types
-- =============================================================
CREATE TABLE IF NOT EXISTS event_types (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 255),
  description TEXT,
  duration    INTEGER     NOT NULL CHECK (duration > 0),   -- minutes
  slug        TEXT        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_types_slug ON event_types (slug);


-- =============================================================
-- TABLE: availability
-- Multiple time blocks allowed per day (e.g. Morning + Evening).
-- label differentiates blocks on the same day.
-- day_of_week: 0=Sunday … 6=Saturday
-- =============================================================
CREATE TABLE IF NOT EXISTS availability (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID    NOT NULL REFERENCES event_types (id) ON DELETE CASCADE,
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  label         TEXT    NOT NULL DEFAULT 'Default'
                          CHECK (char_length(label) BETWEEN 1 AND 64),
  start_time    TIME    NOT NULL,
  end_time      TIME    NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT chk_availability_window CHECK (end_time > start_time),

  -- Allows multiple blocks per day as long as label differs
  CONSTRAINT uq_availability_event_day_label
    UNIQUE (event_type_id, day_of_week, label)
);

CREATE INDEX IF NOT EXISTS idx_availability_event_type_id
  ON availability (event_type_id);

-- Partial index used by slot generation (only active blocks)
CREATE INDEX IF NOT EXISTS idx_availability_event_day_active
  ON availability (event_type_id, day_of_week)
  WHERE is_active = true;


-- =============================================================
-- TABLE: date_overrides
-- Overrides weekly availability for specific dates.
-- Priority: blocked > custom hours > weekly availability
-- =============================================================
CREATE TABLE IF NOT EXISTS date_overrides (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID    NOT NULL REFERENCES event_types (id) ON DELETE CASCADE,
  date          DATE    NOT NULL,
  is_blocked    BOOLEAN NOT NULL DEFAULT false,

  -- Optional custom hours (NULL = only blocking matters)
  start_time    TIME,
  end_time      TIME,

  CONSTRAINT chk_override_coherence CHECK (
    is_blocked = true
    OR (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),

  CONSTRAINT uq_date_override_event_date UNIQUE (event_type_id, date),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_date_overrides_event_date
  ON date_overrides (event_type_id, date);


-- =============================================================
-- TABLE: bookings
-- =============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id    UUID        NOT NULL REFERENCES event_types (id) ON DELETE CASCADE,
  name             TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 255),
  email            TEXT        NOT NULL CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'confirmed'
                               CHECK (status IN ('confirmed', 'cancelled', 'rescheduled')),

  -- Points to the original booking when this is a reschedule
  rescheduled_from UUID        REFERENCES bookings (id) ON DELETE SET NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Anti-double-booking: confirmed bookings can't share a start_time
  CONSTRAINT uq_booking_event_slot UNIQUE (event_type_id, start_time),
  CONSTRAINT chk_booking_window    CHECK  (end_time > start_time)
);

-- Only confirmed bookings participate in availability checks
CREATE INDEX IF NOT EXISTS idx_bookings_event_time
  ON bookings (event_type_id, start_time)
  WHERE status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_bookings_email
  ON bookings (email);

CREATE INDEX IF NOT EXISTS idx_bookings_rescheduled_from
  ON bookings (rescheduled_from)
  WHERE rescheduled_from IS NOT NULL;


-- =============================================================
-- SEED DATA
-- =============================================================

-- Event types
INSERT INTO event_types (id, title, description, duration, slug) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '30-Minute Intro Call',
    'A quick discovery call to understand your needs and how I can help.',
    30,
    '30-min-intro'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '60-Minute Deep Dive',
    'An in-depth session for planning, architecture, or code review.',
    60,
    '60-min-deep-dive'
  )
ON CONFLICT (slug) DO NOTHING;


-- Availability: 30-min intro — Mon–Fri, Morning 09–17 + Evening 18–20
INSERT INTO availability (event_type_id, day_of_week, label, start_time, end_time, is_active) VALUES
  ('11111111-1111-1111-1111-111111111111', 1, 'Default', '09:00', '17:00', true),
  ('11111111-1111-1111-1111-111111111111', 2, 'Default', '09:00', '17:00', true),
  ('11111111-1111-1111-1111-111111111111', 3, 'Default', '09:00', '17:00', true),
  ('11111111-1111-1111-1111-111111111111', 4, 'Default', '09:00', '17:00', true),
  ('11111111-1111-1111-1111-111111111111', 5, 'Default', '09:00', '17:00', true),
  ('11111111-1111-1111-1111-111111111111', 1, 'Evening', '18:00', '20:00', true),
  ('11111111-1111-1111-1111-111111111111', 2, 'Evening', '18:00', '20:00', true),
  ('11111111-1111-1111-1111-111111111111', 3, 'Evening', '18:00', '20:00', true),
  ('11111111-1111-1111-1111-111111111111', 4, 'Evening', '18:00', '20:00', true),
  ('11111111-1111-1111-1111-111111111111', 5, 'Evening', '18:00', '20:00', true)
ON CONFLICT (event_type_id, day_of_week, label) DO NOTHING;

-- Availability: 60-min deep dive — Mon/Wed/Fri 10–16
INSERT INTO availability (event_type_id, day_of_week, label, start_time, end_time, is_active) VALUES
  ('22222222-2222-2222-2222-222222222222', 1, 'Default', '10:00', '16:00', true),
  ('22222222-2222-2222-2222-222222222222', 3, 'Default', '10:00', '16:00', true),
  ('22222222-2222-2222-2222-222222222222', 5, 'Default', '10:00', '16:00', true)
ON CONFLICT (event_type_id, day_of_week, label) DO NOTHING;


-- Date overrides (example data)
INSERT INTO date_overrides (event_type_id, date, is_blocked) VALUES
  ('11111111-1111-1111-1111-111111111111', '2026-04-01', true)   -- April Fools: blocked
ON CONFLICT (event_type_id, date) DO NOTHING;

INSERT INTO date_overrides (event_type_id, date, is_blocked, start_time, end_time) VALUES
  ('11111111-1111-1111-1111-111111111111', '2026-04-05', false, '10:00', '13:00')  -- Saturday special
ON CONFLICT (event_type_id, date) DO NOTHING;


-- Sample bookings
INSERT INTO bookings (event_type_id, name, email, start_time, end_time, status) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Alice Johnson', 'alice@example.com',
    '2026-03-31 09:00:00+00', '2026-03-31 09:30:00+00',
    'confirmed'
  ),
  (
    '11111111-1111-1111-1111-111111111111',
    'Bob Smith', 'bob@example.com',
    '2026-03-31 10:00:00+00', '2026-03-31 10:30:00+00',
    'confirmed'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Carol White', 'carol@example.com',
    '2026-03-31 10:00:00+00', '2026-03-31 11:00:00+00',
    'confirmed'
  )
ON CONFLICT (event_type_id, start_time) DO NOTHING;
