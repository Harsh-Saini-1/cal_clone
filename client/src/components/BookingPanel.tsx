'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getEvents, getSlots, createBooking } from '@/lib/api';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay,
  isBefore, startOfDay, isToday } from 'date-fns';
import {
  X, ChevronLeft, ChevronRight, Clock, Calendar, Check,
  Loader2, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { EventType, TimeSlot } from '@/types';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');

// ── Types ─────────────────────────────────────────────────────
type Stage = 'events' | 'calendar' | 'slots' | 'form' | 'done';

interface BookingPanelProps {
  open: boolean;
  onClose: () => void;
}

// ── Panel ─────────────────────────────────────────────────────
export default function BookingPanel({ open, onClose }: BookingPanelProps) {
  const [stage, setStage] = useState<Stage>('events');
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [form, setForm] = useState({ name: '', email: '' });
  const [confirmedName, setConfirmedName] = useState('');

  const today = startOfDay(new Date());

  // Reset everything when panel closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStage('events');
        setSelectedEvent(null);
        setCurrentMonth(new Date());
        setSelectedDate(null);
        setSelectedSlot(null);
        setForm({ name: '', email: '' });
        setConfirmedName('');
      }, 300);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // ── Data fetching ──────────────────────────────────────────
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
    enabled: open,
  });

  const { data: slots = [], isFetching: slotsFetching } = useQuery({
    queryKey: ['panel-slots', selectedEvent?.id, selectedDate && fmtDate(selectedDate)],
    queryFn: () => getSlots(selectedEvent!.id, fmtDate(selectedDate!)),
    enabled: !!selectedEvent && !!selectedDate,
  });

  const book = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      setConfirmedName(form.name);
      setStage('done');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Calendar grid ──────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    const days: Date[] = [];
    let d = calStart;
    while (d <= calEnd) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [currentMonth]);

  // ── Event selection ─────────────────────────────────────────
  const pickEvent = (ev: EventType) => {
    setSelectedEvent(ev);
    setStage('calendar');
  };

  // ── Date selection ──────────────────────────────────────────
  const pickDate = (day: Date) => {
    setSelectedDate(day);
    setSelectedSlot(null);
    setStage('slots');
  };

  // ── Slot selection ──────────────────────────────────────────
  const pickSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStage('form');
  };

  // ── Book submission ─────────────────────────────────────────
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

  // ── Back navigation ─────────────────────────────────────────
  const goBack = () => {
    if (stage === 'calendar') setStage('events');
    else if (stage === 'slots') { setStage('calendar'); setSelectedDate(null); }
    else if (stage === 'form') { setStage('slots'); setSelectedSlot(null); }
  };

  // ── Breadcrumb title ────────────────────────────────────────
  const title = stage === 'events' ? 'Book a Meeting'
    : stage === 'calendar' ? selectedEvent?.title ?? 'Select Date'
    : stage === 'slots' ? format(selectedDate!, 'EEE, MMM d')
    : stage === 'form' ? 'Your Details'
    : 'Confirmed!';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 90,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 91,
        width: '100%', maxWidth: 420,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: open ? '-12px 0 48px rgba(0,0,0,0.4)' : 'none',
      }}>

        {/* ── Header ───────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {stage !== 'events' && stage !== 'done' && (
            <button onClick={goBack} style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 7, width: 30, height: 30, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--muted)', flexShrink: 0, transition: 'background 0.15s',
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--card-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </p>
            {selectedEvent && stage !== 'events' && stage !== 'done' && (
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                {selectedEvent.duration} min · {selectedEvent.slug}
              </p>
            )}
          </div>

          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--muted)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0,
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Progress dots */}
        {stage !== 'events' && stage !== 'done' && (
          <div style={{ display: 'flex', gap: 5, padding: '10px 20px 0', alignItems: 'center' }}>
            {(['calendar', 'slots', 'form'] as Stage[]).map((s, i) => {
              const stages: Stage[] = ['calendar', 'slots', 'form'];
              const current = stages.indexOf(stage);
              const done = i < current;
              const active = s === stage;
              return (
                <div key={s} style={{
                  height: 3, flex: 1, borderRadius: 99,
                  background: done ? 'var(--primary-dark)' : active ? 'var(--primary)' : 'var(--border)',
                  transition: 'background 0.3s',
                }} />
              );
            })}
          </div>
        )}

        {/* ── Scrollable body ───────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* ── STAGE: Event list ──────────────────────────── */}
          {stage === 'events' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                Choose an event type to get started
              </p>
              {eventsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <div className="spinner" />
                </div>
              ) : events.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>
                  No event types available
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {events.map((ev: EventType) => (
                    <button key={ev.id} onClick={() => pickEvent(ev)} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '16px', borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
                    }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary-dark)';
                        e.currentTarget.style.background = 'var(--primary-glow)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.background = 'var(--card)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: 'var(--primary-dark)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Calendar size={18} color="white" />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{ev.title}</p>
                        {ev.description && (
                          <p style={{
                            fontSize: 12, color: 'var(--muted)', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{ev.description}</p>
                        )}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, color: 'var(--muted-lighter)', marginTop: 4,
                        }}>
                          <Clock size={11} /> {ev.duration} min
                        </span>
                      </div>

                      <ArrowRight size={16} color="var(--muted)" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STAGE: Calendar ───────────────────────────── */}
          {stage === 'calendar' && (
            <div>
              {/* Month nav */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ fontWeight: 600, fontSize: 15 }}>{format(currentMonth, 'MMMM yyyy')}</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-secondary" style={{ padding: '4px 8px' }}
                    onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                    disabled={isSameMonth(currentMonth, today)}>
                    <ChevronLeft size={15} />
                  </button>
                  <button className="btn-secondary" style={{ padding: '4px 8px' }}
                    onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              {/* Weekday headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 6 }}>
                {WEEKDAYS.map((d) => (
                  <div key={d} style={{
                    textAlign: 'center', fontSize: 10, fontWeight: 700,
                    color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '4px 0',
                  }}>{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
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
                        aspectRatio: '1', borderRadius: 8, fontSize: 13,
                        border: active ? '2px solid var(--primary-dark)'
                          : todayMark ? '1px solid var(--primary)' : '1px solid transparent',
                        background: active ? 'var(--primary-dark)' : 'transparent',
                        color: disabled ? 'var(--border)'
                          : active ? 'white'
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

              <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 18 }}>
                Click a date to view available times
              </p>
            </div>
          )}

          {/* ── STAGE: Slots ──────────────────────────────── */}
          {stage === 'slots' && selectedDate && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                Available times on <strong>{format(selectedDate, 'EEEE, MMMM d')}</strong>
              </p>

              {slotsFetching ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <div className="spinner" />
                </div>
              ) : slots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <Clock size={28} color="var(--muted)" style={{ margin: '0 auto 10px' }} />
                  <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 14 }}>No available slots on this day</p>
                  <button className="btn-secondary" style={{ fontSize: 13 }}
                    onClick={() => { setStage('calendar'); setSelectedDate(null); }}>
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

          {/* ── STAGE: Form ───────────────────────────────── */}
          {stage === 'form' && selectedSlot && selectedEvent && (
            <div>
              {/* Slot summary card */}
              <div style={{
                padding: '12px 14px', borderRadius: 10, marginBottom: 24,
                background: 'var(--primary-glow)', border: '1px solid rgba(99,102,241,0.25)',
              }}>
                <p style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                  Your appointment
                </p>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 1 }}>{selectedEvent.title}</p>
                <p style={{ fontSize: 13, color: 'var(--text)' }}>
                  {format(new Date(selectedSlot.start_time), 'EEEE, MMMM d')}
                </p>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>
                  {format(new Date(selectedSlot.start_time), 'h:mm a')} – {format(new Date(selectedSlot.end_time), 'h:mm a')}
                </p>
              </div>

              <form onSubmit={handleBook} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  style={{ marginTop: 8, justifyContent: 'center' }}>
                  {book.isPending
                    ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Booking…</>
                    : 'Confirm Booking'
                  }
                </button>
              </form>
            </div>
          )}

          {/* ── STAGE: Done ───────────────────────────────── */}
          {stage === 'done' && selectedSlot && selectedEvent && (
            <div style={{ textAlign: 'center', padding: '32px 8px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
                background: 'rgba(74,222,128,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={32} color="var(--success)" strokeWidth={2.5} />
              </div>
              <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>You're booked!</h2>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
                A confirmation has been sent to {form.email}
              </p>

              <div style={{
                padding: '14px 18px', borderRadius: 10, textAlign: 'left',
                background: 'var(--card)', border: '1px solid var(--border)', marginBottom: 24,
              }}>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{selectedEvent.title}</p>
                <p style={{ fontSize: 13, color: 'var(--muted-lighter)' }}>
                  {format(new Date(selectedSlot.start_time), 'EEEE, MMMM d, yyyy')}
                </p>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>
                  {format(new Date(selectedSlot.start_time), 'h:mm a')} – {format(new Date(selectedSlot.end_time), 'h:mm a')}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                <button className="btn-primary" style={{ justifyContent: 'center' }}
                  onClick={() => { setStage('events'); setSelectedEvent(null); setSelectedDate(null); setSelectedSlot(null); setForm({ name: '', email: '' }); }}>
                  Book another
                </button>
                <button className="btn-secondary" style={{ justifyContent: 'center' }} onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
