'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvents, getOverrides, upsertOverride, deleteOverride } from '@/lib/api';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Ban, Clock, Calendar, Loader2 } from 'lucide-react';
import type { DateOverride } from '@/types';

const TIME_OPTIONS = (() => {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++)
    for (let m = 0; m < 60; m += 15)
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  return opts;
})();

function fmt12(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function OverridesPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: getEvents });
  const event = events.find((e) => e.id === id);

  const { data: overrides = [], isLoading } = useQuery({
    queryKey: ['overrides', id],
    queryFn: () => getOverrides(id),
    enabled: !!id,
  });

  // Form state
  const [date, setDate] = useState('');
  const [isBlocked, setIsBlocked] = useState(true);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [showForm, setShowForm] = useState(false);

  const upsert = useMutation({
    mutationFn: () =>
      upsertOverride({
        event_type_id: id,
        date,
        is_blocked: isBlocked,
        ...(!isBlocked ? { start_time: startTime, end_time: endTime } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overrides', id] });
      toast.success(isBlocked ? 'Date blocked!' : 'Custom hours saved!');
      setDate('');
      setIsBlocked(true);
      setShowForm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteOverride,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['overrides', id] });
      toast.success('Override removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const formValid = !!date && (isBlocked || endTime > startTime);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <Link href={`/events/${id}/availability`} className="btn-secondary"
        style={{ textDecoration: 'none', marginBottom: 24, display: 'inline-flex' }}>
        <ArrowLeft size={15} /> Back to Availability
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 28, marginTop: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Date Overrides</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>
            {event ? `Block dates or set custom hours for "${event.title}"` : 'Loading…'}
          </p>
        </div>
        <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => setShowForm(!showForm)}>
          <Plus size={15} /> Add Override
        </button>
      </div>

      {/* Add override form */}
      {showForm && (
        <div className="card animate-in" style={{ padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 20 }}>New Date Override</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Date picker */}
            <div>
              <label className="form-label">Date *</label>
              <input
                type="date"
                className="form-input"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ maxWidth: 220 }}
              />
            </div>

            {/* Type toggle */}
            <div>
              <label className="form-label">Override Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setIsBlocked(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
                    borderRadius: 8, border: `1.5px solid ${isBlocked ? 'var(--danger)' : 'var(--border)'}`,
                    background: isBlocked ? 'var(--danger-bg)' : 'transparent',
                    color: isBlocked ? 'var(--danger)' : 'var(--muted)',
                    fontWeight: isBlocked ? 600 : 400, fontSize: 13, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <Ban size={14} /> Block day
                </button>
                <button
                  onClick={() => setIsBlocked(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
                    borderRadius: 8, border: `1.5px solid ${!isBlocked ? 'var(--primary-dark)' : 'var(--border)'}`,
                    background: !isBlocked ? 'var(--primary-glow)' : 'transparent',
                    color: !isBlocked ? 'var(--primary)' : 'var(--muted)',
                    fontWeight: !isBlocked ? 600 : 400, fontSize: 13, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <Clock size={14} /> Custom hours
                </button>
              </div>
            </div>

            {/* Custom time selects */}
            {!isBlocked && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Start Time</label>
                  <select className="form-input" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{fmt12(t)}</option>)}
                  </select>
                </div>
                <span style={{ color: 'var(--muted)', fontSize: 18, marginTop: 20 }}>–</span>
                <div style={{ flex: 1 }}>
                  <label className="form-label">End Time</label>
                  <select className="form-input" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                    {TIME_OPTIONS.map((t) => <option key={t} value={t}>{fmt12(t)}</option>)}
                  </select>
                </div>
              </div>
            )}

            {!isBlocked && endTime <= startTime && (
              <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: -8 }}>End time must be after start time</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn-primary" onClick={() => upsert.mutate()}
                disabled={!formValid || upsert.isPending}>
                {upsert.isPending && <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />}
                {upsert.isPending ? 'Saving…' : 'Save Override'}
              </button>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Overrides list */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : overrides.length === 0 && !showForm ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <Calendar size={36} color="var(--muted)" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 500, marginBottom: 6 }}>No overrides yet</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            Block specific dates or set custom hours that override your weekly schedule.
          </p>
          <button className="btn-primary" onClick={() => setShowForm(true)} style={{ fontSize: 13 }}>
            <Plus size={14} /> Add first override
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {overrides.length} override{overrides.length !== 1 ? 's' : ''}
          </div>
          {overrides.map((o: DateOverride, idx) => (
            <div key={o.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', flexWrap: 'wrap',
              borderBottom: idx < overrides.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              transition: 'background 0.15s',
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--card-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {/* Status icon */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: o.is_blocked ? 'var(--danger-bg)' : 'var(--primary-glow)',
              }}>
                {o.is_blocked
                  ? <Ban size={16} color="var(--danger)" />
                  : <Clock size={16} color="var(--primary)" />
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                  {format(new Date(o.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                </p>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {o.is_blocked
                    ? 'Blocked — no slots available'
                    : o.start_time && o.end_time
                      ? `Custom hours: ${fmt12(o.start_time.slice(0, 5))} – ${fmt12(o.end_time.slice(0, 5))}`
                      : 'Fallback to weekly schedule'
                  }
                </p>
              </div>

              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 99,
                background: o.is_blocked ? 'var(--danger-bg)' : 'var(--primary-glow)',
                color: o.is_blocked ? 'var(--danger)' : 'var(--primary)',
                border: `1px solid ${o.is_blocked ? 'rgba(248,113,113,0.3)' : 'rgba(99,102,241,0.2)'}`,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {o.is_blocked ? 'Blocked' : 'Custom'}
              </span>

              <button
                className="btn-danger"
                style={{ padding: '5px 10px', fontSize: 12, flexShrink: 0 }}
                onClick={() => { if (window.confirm('Remove this override?')) remove.mutate(o.id); }}
                disabled={remove.isPending}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
