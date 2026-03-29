'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { getEventBySlug, getSlots } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
  isToday,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ChevronLeft, ChevronRight, Clock, Loader2, Calendar, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import type { TimeSlot } from '@/types';

const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Toronto', label: 'Toronto (ET)' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Seoul', label: 'Korea (KST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'Africa/Cairo', label: 'Cairo (EET)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
];

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'America/New_York';
  }
}

function createBookingAPI(body: { event_type_id: string; name: string; email: string; start_time: string }) {
  const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return fetch(`${BASE}/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const json = await res.json();
    if (!json.success || !res.ok) throw new Error(json.error ?? 'Booking failed');
    return json.data;
  });
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const { data: event, isLoading: evLoading, isError } = useQuery({
    queryKey: ['event-slug', slug],
    queryFn: () => getEventBySlug(slug),
  });

  const today = startOfDay(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const [timezone, setTimezone] = useState<string>('');
  const [showTzDropdown, setShowTzDropdown] = useState(false);
  const [tzSearch, setTzSearch] = useState('');

  useEffect(() => { setTimezone(detectTimezone()); }, []);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) { days.push(day); day = addDays(day, 1); }
    return days;
  }, [currentMonth]);

  const { data: slots = [], isFetching: slotsFetching } = useQuery({
    queryKey: ['slots', event?.id, selectedDate && fmtDate(selectedDate)],
    queryFn: () => getSlots(event!.id, fmtDate(selectedDate!)),
    enabled: !!event && !!selectedDate,
  });

  const displaySlots = useMemo(() => {
    if (!timezone || slots.length === 0) return slots;
    return slots.map((s) => ({
      ...s,
      _displayStart: toZonedTime(new Date(s.start_time), timezone),
      _displayEnd: toZonedTime(new Date(s.end_time), timezone),
    }));
  }, [slots, timezone]);

  const book = useMutation({
    mutationFn: createBookingAPI,
    onSuccess: (data) => {
      router.push(
        `/book/${slug}/confirm?name=${encodeURIComponent(form.name)}&start=${encodeURIComponent(data.start_time)}&title=${encodeURIComponent(event!.title)}`
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredTimezones = useMemo(() => {
    if (!tzSearch) return COMMON_TIMEZONES;
    const lower = tzSearch.toLowerCase();
    return COMMON_TIMEZONES.filter(
      (tz) => tz.label.toLowerCase().includes(lower) || tz.value.toLowerCase().includes(lower)
    );
  }, [tzSearch]);

  const currentTzLabel = COMMON_TIMEZONES.find((tz) => tz.value === timezone)?.label || timezone;

  // Always 2-col: left info + right center (calendar / slots / form)
  const cardClass = 'booking-card booking-card--2col';

  if (evLoading) {
    return <div className="booking-shell"><div className="spinner" /></div>;
  }

  if (isError || !event) {
    return (
      <div className="booking-shell" style={{ flexDirection: 'column', gap: 16 }}>
        <Calendar size={48} color="var(--muted)" />
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Event not found</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>The link <code>/book/{slug}</code> doesn&apos;t exist.</p>
      </div>
    );
  }

  return (
    <div className="booking-shell">
      <div className={cardClass}>

        {/* ── LEFT — Event info ── */}
        <div className="booking-left">
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: 'var(--primary-dark)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          }}>
            <Calendar size={22} color="white" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{event.title}</h1>
          {event.description && (
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 20 }}>{event.description}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted-lighter)' }}>
            <Clock size={14} /> {event.duration} minutes
          </div>

          {/* Showing selected date when slots are visible */}
          {selectedDate && !selectedSlot && (
            <div style={{
              marginTop: 20, padding: '10px 14px',
              background: 'var(--primary-glow)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 8,
            }}>
              <p style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                Selected date
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {format(selectedDate, 'EEEE, MMM d')}
              </p>
            </div>
          )}

          {/* Selected slot summary */}
          {selectedSlot && (
            <div style={{
              marginTop: 20, padding: 16, background: 'var(--primary-glow)',
              border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10,
            }}>
              <p style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Selected</p>
              <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
                {format(new Date(selectedSlot.start_time), 'EEEE, MMM d')}
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                {timezone
                  ? format(toZonedTime(new Date(selectedSlot.start_time), timezone), 'h:mm a')
                  : format(new Date(selectedSlot.start_time), 'h:mm a')
                }
              </p>
            </div>
          )}

          {/* Timezone selector */}
          <div style={{ marginTop: 20, position: 'relative' }}>
            <button
              onClick={() => setShowTzDropdown(!showTzDropdown)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '8px 12px', color: 'var(--muted-lighter)', fontSize: 12, cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <Globe size={13} />
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentTzLabel}
              </span>
              <ChevronRight size={13} style={{
                transform: showTzDropdown ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }} />
            </button>

            {showTzDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: '0 12px 32px rgba(0,0,0,0.5)', zIndex: 50,
                maxHeight: 260, display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ padding: '8px 8px 4px' }}>
                  <input
                    type="text" placeholder="Search timezone..."
                    value={tzSearch} onChange={(e) => setTzSearch(e.target.value)}
                    className="form-input" style={{ fontSize: 12, padding: '6px 10px' }}
                    autoFocus
                  />
                </div>
                <div style={{ overflow: 'auto', flex: 1 }}>
                  {filteredTimezones.map((tz) => (
                    <button key={tz.value}
                      onClick={() => { setTimezone(tz.value); setShowTzDropdown(false); setTzSearch(''); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 14px', border: 'none', cursor: 'pointer',
                        background: tz.value === timezone ? 'var(--primary-glow)' : 'transparent',
                        color: tz.value === timezone ? 'var(--primary)' : 'var(--text)',
                        fontSize: 12, transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { if (tz.value !== timezone) e.currentTarget.style.background = 'var(--card-hover)'; }}
                      onMouseLeave={(e) => { if (tz.value !== timezone) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {tz.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER — Calendar → Slot grid → Booking form ── */}
        <div className="booking-center">

          {/* ── STEP 1: Calendar (no date selected yet) ── */}
          {!selectedDate && (
            <div className="animate-in">
              {/* Month navigation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <p style={{ fontWeight: 600, fontSize: 16 }}>{format(currentMonth, 'MMMM yyyy')}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-secondary" style={{ padding: '5px 10px' }}
                    onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                    disabled={isSameMonth(currentMonth, today)}>
                    <ChevronLeft size={16} />
                  </button>
                  <button className="btn-secondary" style={{ padding: '5px 10px' }}
                    onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Weekday headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
                {WEEKDAY_HEADERS.map((d) => (
                  <div key={d} style={{
                    textAlign: 'center', fontSize: 11, fontWeight: 600,
                    color: 'var(--muted)', textTransform: 'uppercase',
                    letterSpacing: '0.06em', padding: '4px 0',
                  }}>{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {calendarDays.map((day) => {
                  const inMonth = isSameMonth(day, currentMonth);
                  const past = isBefore(day, today) && !isToday(day);
                  const todayMark = isToday(day);
                  const disabled = !inMonth || past;
                  return (
                    <button key={day.toISOString()} disabled={disabled}
                      onClick={() => { setSelectedDate(day); setSelectedSlot(null); }}
                      style={{
                        aspectRatio: '1', borderRadius: 10,
                        border: todayMark ? '1px solid var(--primary)' : '1px solid transparent',
                        background: 'transparent',
                        color: disabled ? 'var(--border)' : !inMonth ? 'var(--border)' : 'var(--text)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: 14, fontWeight: todayMark ? 600 : 400,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        if (!disabled) {
                          e.currentTarget.style.background = 'var(--primary-glow)';
                          e.currentTarget.style.borderColor = 'var(--primary-dark)';
                          e.currentTarget.style.color = 'var(--primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!disabled) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = todayMark ? 'var(--primary)' : 'transparent';
                          e.currentTarget.style.color = disabled ? 'var(--border)' : 'var(--text)';
                        }
                      }}
                    >
                      {format(day, 'd')}
                      {todayMark && (
                        <span style={{
                          position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
                          width: 4, height: 4, borderRadius: '50%', background: 'var(--primary)',
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>

              <p style={{
                color: 'var(--muted)', fontSize: 13, textAlign: 'center', marginTop: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Calendar size={14} /> Select a date to see available times
              </p>
            </div>
          )}

          {/* ── STEP 2: Slot grid (date selected, no slot chosen yet) ── */}
          {selectedDate && !selectedSlot && (
            <div className="animate-in">
              {/* Header with back button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <button
                  className="btn-secondary"
                  style={{ padding: '5px 10px', flexShrink: 0 }}
                  onClick={() => setSelectedDate(null)}
                >
                  <ChevronLeft size={16} />
                </button>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>{format(selectedDate, 'EEEE, MMMM d')}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Pick a time below</p>
                </div>
              </div>

              {/* Slot grid */}
              {slotsFetching ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 180 }}>
                  <div className="spinner" />
                </div>
              ) : slots.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 10, minHeight: 180, opacity: 0.7,
                }}>
                  <Clock size={28} color="var(--muted)" />
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>No available slots on this day</p>
                  <button className="btn-secondary" style={{ fontSize: 13, marginTop: 4 }}
                    onClick={() => setSelectedDate(null)}>
                    Pick another date
                  </button>
                </div>
              ) : (
                <div className="slot-grid">
                  {displaySlots.map((s: any) => (
                    <button
                      key={s.start_time}
                      className="slot-btn"
                      onClick={() => setSelectedSlot(s)}
                    >
                      {s._displayStart
                        ? format(s._displayStart, 'h:mm a')
                        : format(new Date(s.start_time), 'h:mm a')
                      }
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Booking form (slot chosen) ── */}
          {selectedSlot && (
            <div className="animate-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <button className="btn-secondary" style={{ padding: '6px 10px' }}
                  onClick={() => setSelectedSlot(null)}>
                  <ChevronLeft size={16} />
                </button>
                <div>
                  <p style={{ fontWeight: 600 }}>{format(new Date(selectedSlot.start_time), 'EEEE, MMMM d')}</p>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {timezone
                      ? `${format(toZonedTime(new Date(selectedSlot.start_time), timezone), 'h:mm a')} – ${format(toZonedTime(new Date(selectedSlot.end_time), timezone), 'h:mm a')}`
                      : `${format(new Date(selectedSlot.start_time), 'h:mm a')} – ${format(new Date(selectedSlot.end_time), 'h:mm a')}`
                    }
                  </p>
                </div>
              </div>

              <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 24 }}>Enter your details</h2>

              <form onSubmit={(e) => {
                e.preventDefault();
                book.mutate({ event_type_id: event.id, name: form.name, email: form.email, start_time: selectedSlot.start_time });
              }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label className="form-label">Your Name *</label>
                  <input className="form-input" placeholder="Jane Smith" value={form.name} required
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Email Address *</label>
                  <input className="form-input" type="email" placeholder="jane@example.com" value={form.email} required
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <button className="btn-primary" type="submit" disabled={book.isPending} style={{ marginTop: 8 }}>
                  {book.isPending && <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />}
                  {book.isPending ? 'Booking…' : 'Confirm Booking'}
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
