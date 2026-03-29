'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBookings, cancelBooking, getSlots, rescheduleBooking } from '@/lib/api';
import { format, addDays, startOfDay, isBefore, isSameDay } from 'date-fns';
import {
  Calendar, Clock, Users, Trash2, CalendarDays,
  ChevronLeft, ChevronRight, X, RefreshCw, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import type { Booking, TimeSlot } from '@/types';
import { useState, useMemo } from 'react';

// ── Status badge component ─────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  confirmed:   { bg: 'rgba(74,222,128,0.12)',  color: 'var(--success)' },
  cancelled:   { bg: 'rgba(248,113,113,0.12)', color: 'var(--danger)' },
  rescheduled: { bg: 'rgba(251,191,36,0.12)',  color: 'var(--warning)' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.cancelled;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11,
      fontWeight: 600, padding: '3px 9px', borderRadius: 99, textTransform: 'capitalize',
      background: s.bg, color: s.color, letterSpacing: '0.03em',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {status}
    </span>
  );
}

// ── Reschedule Modal ───────────────────────────────────────
function RescheduleModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const qc = useQueryClient();
  const today = startOfDay(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [offset, setOffset] = useState(0); // days offset from today for the date strip

  const dateOptions = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => addDays(today, i + 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const visible = dateOptions.slice(offset, offset + 7);

  const { data: slots = [], isFetching } = useQuery({
    queryKey: ['reschedule-slots', booking.event_type_id, selectedDate?.toISOString()],
    queryFn: () => getSlots(
      booking.event_type_id,
      format(selectedDate!, 'yyyy-MM-dd')
    ),
    enabled: !!selectedDate,
  });

  const reschedule = useMutation({
    mutationFn: (slot: TimeSlot) =>
      rescheduleBooking({ booking_id: booking.id, new_start_time: slot.start_time }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking rescheduled!');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card animate-in" style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 2 }}>Reschedule Booking</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              {booking.name} · {booking.event_types?.title}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', padding: 4,
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Current booking info */}
        <div style={{
          margin: '20px 24px', padding: 14, borderRadius: 8,
          background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 13,
        }}>
          <p style={{ color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Current time</p>
          <p style={{ fontWeight: 600 }}>{format(new Date(booking.start_time), 'EEEE, MMM d, yyyy · h:mm a')}</p>
        </div>

        {/* Date strip */}
        <div style={{ padding: '0 24px', marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pick a new date
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setOffset(Math.max(0, offset - 7))} disabled={offset === 0}
              className="btn-secondary" style={{ padding: '5px 8px', flexShrink: 0 }}>
              <ChevronLeft size={15} />
            </button>

            <div style={{ display: 'flex', gap: 6, flex: 1, overflowX: 'auto' }}>
              {visible.map((d) => {
                const active = selectedDate ? isSameDay(d, selectedDate) : false;
                return (
                  <button key={d.toISOString()}
                    onClick={() => setSelectedDate(d)}
                    style={{
                      flex: 1, minWidth: 52, padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                      border: active ? '2px solid var(--primary-dark)' : '1px solid var(--border)',
                      background: active ? 'var(--primary-glow)' : 'transparent',
                      color: active ? 'var(--primary)' : 'var(--text)',
                      fontWeight: active ? 700 : 400, textAlign: 'center', fontSize: 12,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ color: active ? 'var(--primary)' : 'var(--muted)', marginBottom: 2, fontSize: 10, textTransform: 'uppercase' }}>
                      {format(d, 'EEE')}
                    </div>
                    {format(d, 'd')}
                  </button>
                );
              })}
            </div>

            <button onClick={() => setOffset(Math.min(7, offset + 7))} disabled={offset >= 7}
              className="btn-secondary" style={{ padding: '5px 8px', flexShrink: 0 }}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Slot grid */}
        <div style={{ padding: '0 24px 24px' }}>
          {!selectedDate ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
              Select a date above to see available times
            </p>
          ) : isFetching ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div className="spinner" />
            </div>
          ) : slots.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
              No available slots on this day
            </p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Available times on {format(selectedDate, 'MMM d')}
              </p>
              <div className="slot-grid">
                {slots.map((s: TimeSlot) => (
                  <button key={s.start_time} className="slot-btn"
                    disabled={reschedule.isPending}
                    onClick={() => reschedule.mutate(s)}>
                    {reschedule.isPending
                      ? <Loader2 size={13} style={{ animation: 'spin 0.7s linear infinite' }} />
                      : format(new Date(s.start_time), 'h:mm a')
                    }
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard page ─────────────────────────────────────────
export default function DashboardPage() {
  const qc = useQueryClient();
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: getBookings,
  });

  const cancel = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); toast.success('Booking cancelled'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const now = new Date();
  const confirmed  = bookings.filter((b) => b.status === 'confirmed');
  const upcoming   = confirmed.filter((b) => new Date(b.start_time) > now);
  const past       = confirmed.filter((b) => !isBefore(now, new Date(b.start_time)));
  const todayMtgs  = confirmed.filter((b) => isSameDay(new Date(b.start_time), now));

  const filtered = filter === 'upcoming' ? upcoming : filter === 'past' ? past : bookings;

  const stats = [
    { label: 'Upcoming',         value: upcoming.length,  icon: Calendar,    color: 'var(--primary)' },
    { label: "Today's Meetings", value: todayMtgs.length, icon: Clock,       color: 'var(--success)' },
    { label: 'Total Confirmed',  value: confirmed.length, icon: Users,       color: 'var(--warning)' },
  ];

  return (
    <div className="page-container" style={{ maxWidth: 1040 }}>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>Overview of your scheduled meetings</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 34, fontWeight: 700 }}>{s.value}</p>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: `${s.color}1a`,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={20} color={s.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bookings table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 12,
        }}>
          <h2 style={{ fontWeight: 600, fontSize: 16 }}>Bookings</h2>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filter buttons */}
            {(['upcoming', 'past', 'all'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={filter === f ? 'btn-primary' : 'btn-secondary'}
                style={{ fontSize: 12, padding: '5px 14px', textTransform: 'capitalize' }}>
                {f}
              </button>
            ))}
            <Link href="/events" className="btn-secondary" style={{ textDecoration: 'none', fontSize: 13 }}>
              <CalendarDays size={14} /> Events
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Calendar size={36} color="var(--muted)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              No {filter !== 'all' ? filter : ''} bookings
            </p>
          </div>
        ) : (
          <>
            {/* ── Desktop table (hidden on mobile) ── */}
            <div className="booking-table-desktop">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Guest', 'Event', 'Time', 'Status', ''].map((h) => (
                      <th key={h} style={{
                        padding: '12px 24px', textAlign: 'left', fontSize: 12,
                        fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase',
                        letterSpacing: '0.05em', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b: Booking) => (
                    <tr key={b.id}
                      style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 24px' }}>
                        <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{b.name}</p>
                        <p style={{ fontSize: 12, color: 'var(--muted)' }}>{b.email}</p>
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: 13, color: 'var(--muted-lighter)' }}>
                        {b.event_types?.title ?? '—'}
                      </td>
                      <td style={{ padding: '14px 24px', fontSize: 13, color: 'var(--muted-lighter)', whiteSpace: 'nowrap' }}>
                        {format(new Date(b.start_time), 'MMM d, yyyy · h:mm a')}
                      </td>
                      <td style={{ padding: '14px 24px' }}>
                        <StatusBadge status={b.status} />
                      </td>
                      <td style={{ padding: '14px 24px' }}>
                        {b.status === 'confirmed' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }}
                              onClick={() => setRescheduleTarget(b)} title="Reschedule">
                              <RefreshCw size={12} />
                            </button>
                            <button className="btn-danger" style={{ padding: '5px 10px', fontSize: 12 }}
                              onClick={() => cancel.mutate(b.id)} disabled={cancel.isPending} title="Cancel">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile card list (hidden on desktop) ── */}
            <div className="booking-cards-mobile">
              {filtered.map((b: Booking, idx) => (
                <div key={b.id} style={{
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  {/* Row 1: Guest */}
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{b.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--muted)' }}>{b.email}</p>
                  </div>

                  {/* Row 2: Time + Status badge side by side */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: 'var(--muted-lighter)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={13} color="var(--muted)" />
                      {format(new Date(b.start_time), 'MMM d · h:mm a')}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>

                  {/* Row 3: Action buttons (only for confirmed) */}
                  {b.status === 'confirmed' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary"
                        style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '7px 0' }}
                        onClick={() => setRescheduleTarget(b)}>
                        <RefreshCw size={13} /> Reschedule
                      </button>
                      <button className="btn-danger"
                        style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '7px 0' }}
                        onClick={() => cancel.mutate(b.id)} disabled={cancel.isPending}>
                        <Trash2 size={13} /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Reschedule modal */}
      {rescheduleTarget && (
        <RescheduleModal
          booking={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
        />
      )}
    </div>
  );
}
