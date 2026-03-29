'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { getEvents, getSlots, createBooking } from '@/lib/api';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  isBefore, startOfDay, isToday,
} from 'date-fns';
import {
  ChevronLeft, ChevronRight, Clock, Calendar, Check,
  Loader2, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { EventType, TimeSlot } from '@/types';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');

function detectTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
}

type Stage = 'events' | 'calendar' | 'slots' | 'form' | 'done';

export default function PublicBookingPage() {
  const searchParams = useSearchParams();
  const preselectedSlug = searchParams.get('event');

  const [stage, setStage] = useState<Stage>('events');
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const [timezone] = useState(detectTimezone);

  const today = startOfDay(new Date());

  // ── Data ──────────────────────────────────────────────────────
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
  });

  // Auto-select event from ?event=slug query param
  useEffect(() => {
    if (!preselectedSlug || events.length === 0 || selectedEvent) return;
    const match = events.find((ev: EventType) => ev.slug === preselectedSlug);
    if (match) {
      setSelectedEvent(match);
      setStage('calendar');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedSlug, events]);

  const { data: slots = [], isFetching: slotsFetching } = useQuery({
    queryKey: ['pub-slots', selectedEvent?.id, selectedDate && fmtDate(selectedDate)],
    queryFn: () => getSlots(selectedEvent!.id, fmtDate(selectedDate!)),
    enabled: !!selectedEvent && !!selectedDate,
  });

  const book = useMutation({
    mutationFn: createBooking,
    onSuccess: () => setStage('done'),
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Calendar grid ─────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const s = startOfWeek(startOfMonth(currentMonth));
    const e = endOfWeek(endOfMonth(currentMonth));
    const days: Date[] = [];
    let d = s;
    while (d <= e) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [currentMonth]);

  // ── Navigation ────────────────────────────────────────────────
  const pickEvent = (ev: EventType) => { setSelectedEvent(ev); setStage('calendar'); };
  const pickDate  = (d: Date)       => { setSelectedDate(d); setSelectedSlot(null); setStage('slots'); };
  const pickSlot  = (s: TimeSlot)   => { setSelectedSlot(s); setStage('form'); };

  const goBack = () => {
    if (stage === 'calendar') { setStage('events'); }
    else if (stage === 'slots')    { setStage('calendar'); setSelectedDate(null); }
    else if (stage === 'form')     { setStage('slots'); setSelectedSlot(null); }
  };

  const reset = () => {
    setStage('events');
    setSelectedEvent(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setForm({ name: '', email: '' });
    setCurrentMonth(new Date());
  };

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !selectedSlot) return;
    book.mutate({
      event_type_id: selectedEvent.id,
      name: form.name,
      email: form.email,
      start_time: selectedSlot.start_time,
    });
  };

  // ── Progress steps ────────────────────────────────────────────
  const STEPS = ['Choose Event', 'Pick Date', 'Pick Time', 'Your Details'];
  const stepIdx = stage === 'events' ? 0 : stage === 'calendar' ? 1 : stage === 'slots' ? 2 : stage === 'form' ? 3 : 4;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 60 }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 0' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Book a Meeting</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>
          Choose an event type and pick a time that works for you.
        </p>
      </div>

      {/* ── Progress bar (hides on events/done stage) ─────────── */}
      {stage !== 'events' && stage !== 'done' && (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 24px 0' }}>
          {/* Step labels */}
          <div style={{ display: 'flex', marginBottom: 8 }}>
            {STEPS.map((label, i) => (
              <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: i < stepIdx ? 600 : i === stepIdx ? 700 : 400,
                  color: i < stepIdx ? 'var(--success)' : i === stepIdx ? 'var(--primary)' : 'var(--muted)',
                }}>
                  {i < stepIdx ? '✓ ' : ''}{label}
                </span>
              </div>
            ))}
          </div>
          {/* Progress track */}
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: 'var(--primary-dark)', borderRadius: 99,
              width: `${(stepIdx / (STEPS.length - 1)) * 100}%`,
              transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
        </div>
      )}


      {/* ── Main content ──────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 0' }}>

        {/* ── STAGE: Event list ──────────────────────────────── */}
        {stage === 'events' && (
          <div>
            {eventsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                <div className="spinner" />
              </div>
            ) : events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 80, color: 'var(--muted)' }}>
                No event types available yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {events.map((ev: EventType) => (
                  <button key={ev.id} onClick={() => pickEvent(ev)} style={{
                    display: 'flex', alignItems: 'center', gap: 18,
                    padding: '20px 22px', borderRadius: 14,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'border-color 0.15s, background 0.15s, transform 0.12s, box-shadow 0.15s',
                  }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-dark)';
                      e.currentTarget.style.background = 'var(--primary-glow)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--card)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      background: 'var(--primary-dark)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Calendar size={22} color="white" />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{ev.title}</p>
                      {ev.description && (
                        <p style={{
                          fontSize: 13, color: 'var(--muted)', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6,
                        }}>{ev.description}</p>
                      )}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12,
                        color: 'var(--primary)', fontWeight: 500,
                        background: 'var(--primary-glow)', padding: '2px 10px',
                        borderRadius: 99, border: '1px solid rgba(99,102,241,0.2)',
                      }}>
                        <Clock size={11} /> {ev.duration} min
                      </span>
                    </div>

                    <ArrowRight size={20} color="var(--muted)" style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STAGE: Calendar ───────────────────────────────── */}
        {stage === 'calendar' && (
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={goBack}>
                <ChevronLeft size={16} /> Back
              </button>
              <div>
                <p style={{ fontWeight: 700, fontSize: 17 }}>{selectedEvent?.title}</p>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Select a date</p>
              </div>
            </div>

            {/* Month nav */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontWeight: 600, fontSize: 16 }}>{format(currentMonth, 'MMMM yyyy')}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" style={{ padding: '5px 10px' }}
                  onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                  disabled={isSameMonth(currentMonth, today)}>
                  <ChevronLeft size={15} />
                </button>
                <button className="btn-secondary" style={{ padding: '5px 10px' }}
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>

            {/* Weekday headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 8 }}>
              {WEEKDAYS.map((d) => (
                <div key={d} style={{
                  textAlign: 'center', fontSize: 11, fontWeight: 700,
                  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 0',
                }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
              {calendarDays.map((day) => {
                const inMonth = isSameMonth(day, currentMonth);
                const past = isBefore(day, today) && !isToday(day);
                const todayMark = isToday(day);
                const active = selectedDate ? isSameDay(day, selectedDate) : false;
                const disabled = !inMonth || past;

                return (
                  <button key={day.toISOString()} disabled={disabled}
                    onClick={() => pickDate(day)}
                    style={{
                      aspectRatio: '1', borderRadius: 10, fontSize: 14,
                      border: active ? '2px solid var(--primary-dark)'
                        : todayMark ? '1px solid var(--primary)' : '1px solid transparent',
                      background: active ? 'var(--primary-dark)' : 'transparent',
                      color: disabled ? 'var(--border)' : active ? 'white'
                        : todayMark ? 'var(--primary)' : 'var(--text)',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontWeight: active || todayMark ? 700 : 400,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (!disabled && !active) {
                        e.currentTarget.style.background = 'var(--primary-glow)';
                        e.currentTarget.style.color = 'var(--primary)';
                        e.currentTarget.style.borderColor = 'var(--primary-dark)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!disabled && !active) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = disabled ? 'var(--border)' : 'var(--text)';
                        e.currentTarget.style.borderColor = todayMark ? 'var(--primary)' : 'transparent';
                      }
                    }}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 20 }}>
              Click a date to see available times
            </p>
          </div>
        )}

        {/* ── STAGE: Slots ──────────────────────────────────── */}
        {stage === 'slots' && selectedDate && (
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={goBack}>
                <ChevronLeft size={16} /> Back
              </button>
              <div>
                <p style={{ fontWeight: 700, fontSize: 17 }}>{format(selectedDate, 'EEEE, MMMM d')}</p>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {selectedEvent?.duration} min · pick a time below
                </p>
              </div>
            </div>

            {slotsFetching ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div className="spinner" />
              </div>
            ) : slots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <Clock size={32} color="var(--muted)" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 16 }}>No available slots on this day</p>
                <button className="btn-secondary" onClick={() => { setStage('calendar'); setSelectedDate(null); }}>
                  Pick another date
                </button>
              </div>
            ) : (
              <div className="slot-grid">
                {slots.map((s: TimeSlot) => (
                  <button key={s.start_time} className="slot-btn" onClick={() => pickSlot(s)}>
                    {format(new Date(s.start_time), 'h:mm a')}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STAGE: Form ───────────────────────────────────── */}
        {stage === 'form' && selectedSlot && selectedEvent && (
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={goBack}>
                <ChevronLeft size={16} /> Back
              </button>
              <p style={{ fontWeight: 700, fontSize: 17 }}>Enter your details</p>
            </div>

            {/* Appointment summary */}
            <div style={{
              padding: '14px 18px', borderRadius: 10, marginBottom: 24,
              background: 'var(--primary-glow)', border: '1px solid rgba(99,102,241,0.25)',
            }}>
              <p style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Your appointment
              </p>
              <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{selectedEvent.title}</p>
              <p style={{ fontSize: 13, color: 'var(--muted-lighter)' }}>
                {format(new Date(selectedSlot.start_time), 'EEEE, MMMM d, yyyy')}
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                {format(new Date(selectedSlot.start_time), 'h:mm a')} – {format(new Date(selectedSlot.end_time), 'h:mm a')}
              </p>
            </div>

            <form onSubmit={handleBook} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="form-label">Your Name *</label>
                <input className="form-input" placeholder="Jane Smith" required
                  value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Email Address *</label>
                <input className="form-input" type="email" placeholder="jane@example.com" required
                  value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <button className="btn-primary" type="submit" disabled={book.isPending}
                style={{ justifyContent: 'center', marginTop: 8 }}>
                {book.isPending
                  ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Booking…</>
                  : 'Confirm Booking'
                }
              </button>
            </form>
          </div>
        )}

        {/* ── STAGE: Done ───────────────────────────────────── */}
        {stage === 'done' && selectedSlot && selectedEvent && (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
              background: 'rgba(74,222,128,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={36} color="var(--success)" strokeWidth={2.5} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>You're booked! 🎉</h2>
            <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 28 }}>
              A confirmation has been sent to <strong>{form.email}</strong>
            </p>

            <div style={{
              padding: '16px 20px', borderRadius: 12, textAlign: 'left',
              background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 28,
              maxWidth: 360, margin: '0 auto 28px',
            }}>
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{selectedEvent.title}</p>
              <p style={{ fontSize: 13, color: 'var(--muted-lighter)', marginBottom: 4 }}>
                {format(new Date(selectedSlot.start_time), 'EEEE, MMMM d, yyyy')}
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>
                {format(new Date(selectedSlot.start_time), 'h:mm a')} – {format(new Date(selectedSlot.end_time), 'h:mm a')}
              </p>
            </div>

            <button className="btn-primary" style={{ justifyContent: 'center' }} onClick={reset}>
              Book another meeting
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
