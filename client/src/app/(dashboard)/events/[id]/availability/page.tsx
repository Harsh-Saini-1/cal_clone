'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvents, getAvailability, setAvailability } from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Trash2, Clock, Globe, ExternalLink } from 'lucide-react';
import type { Availability } from '@/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

interface Block {
  _key: string;   // local unique key for React
  label: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

type DayState = Block[];

const DEFAULT_BLOCK = (): Block => ({
  _key: Math.random().toString(36).slice(2),
  label: 'Default',
  start_time: '09:00',
  end_time: '17:00',
  is_active: true,
});

function makeDefault(): DayState[] {
  return DAYS.map((_, i) =>
    i >= 1 && i <= 5 ? [DEFAULT_BLOCK()] : []
  );
}

function detectTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
}

export default function AvailabilityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: getEvents });
  const event = events.find((e) => e.id === id);

  const { data: existing = [], isLoading } = useQuery({
    queryKey: ['availability', id],
    queryFn: () => getAvailability(id),
    enabled: !!id,
  });

  // days[0..6] = array of Block[]
  const [days, setDays] = useState<DayState[]>(makeDefault);
  const [timezone] = useState(detectTimezone);

  // Hydrate from server data
  useEffect(() => {
    if (existing.length === 0) return;
    const fresh: DayState[] = DAYS.map(() => []);
    existing.forEach((a: Availability) => {
      fresh[a.day_of_week].push({
        _key: a.id,
        label: a.label ?? 'Default',
        start_time: a.start_time.slice(0, 5),
        end_time: a.end_time.slice(0, 5),
        is_active: a.is_active ?? true,
      });
    });
    setDays(fresh);
  }, [existing]);

  const save = useMutation({
    mutationFn: () => {
      const windows = days.flatMap((blocks, dow) =>
        blocks.map((b) => ({
          day_of_week: dow,
          label: b.label.trim() || 'Default',
          start_time: b.start_time,
          end_time: b.end_time,
          is_active: b.is_active,
        }))
      );
      return setAvailability({ event_type_id: id, windows });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availability', id] });
      toast.success('Availability saved!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Validate: any block where end <= start
  const errors = useMemo(() =>
    days.map((blocks) => blocks.map((b) => b.end_time <= b.start_time)),
    [days]
  );
  const hasErrors = errors.some((day) => day.some(Boolean));

  // ── Block mutations ──────────────────────────────────────────
  const addBlock = (dow: number) => {
    setDays((prev) => {
      const copy = prev.map((d) => [...d]);
      copy[dow] = [...copy[dow], {
        ...DEFAULT_BLOCK(),
        label: copy[dow].length === 0 ? 'Default' : `Block ${copy[dow].length + 1}`,
      }];
      return copy;
    });
  };

  const removeBlock = (dow: number, idx: number) => {
    setDays((prev) => {
      const copy = prev.map((d) => [...d]);
      copy[dow] = copy[dow].filter((_, i) => i !== idx);
      return copy;
    });
  };

  const updateBlock = (dow: number, idx: number, patch: Partial<Block>) => {
    setDays((prev) => {
      const copy = prev.map((d) => [...d]);
      copy[dow] = copy[dow].map((b, i) => i === idx ? { ...b, ...patch } : b);
      return copy;
    });
  };

  const toggleDay = (dow: number) => {
    setDays((prev) => {
      const copy = prev.map((d) => [...d]);
      if (copy[dow].length === 0) {
        copy[dow] = [DEFAULT_BLOCK()];
      } else {
        // Toggle all blocks' is_active
        const allActive = copy[dow].every((b) => b.is_active);
        copy[dow] = copy[dow].map((b) => ({ ...b, is_active: !allActive }));
      }
      return copy;
    });
  };

  const enabledDays = days.filter((d) => d.length > 0 && d.some((b) => b.is_active)).length;

  return (
    <div className="page-container" style={{ maxWidth: 780 }}>
      <Link href="/events" className="btn-secondary" style={{ textDecoration: 'none', marginBottom: 24, display: 'inline-flex' }}>
        <ArrowLeft size={15} /> Back
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 8, marginTop: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Availability</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>
            {event ? `Weekly schedule for "${event.title}"` : 'Loading…'}
          </p>
        </div>

        {/* Overrides link */}
        <Link
          href={`/events/${id}/overrides`}
          className="btn-secondary"
          style={{ textDecoration: 'none', fontSize: 13 }}
        >
          <ExternalLink size={13} /> Date Overrides
        </Link>
      </div>

      {/* Timezone + summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '10px 14px', background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24, fontSize: 13,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted-lighter)' }}>
          <Globe size={13} /> {timezone}
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 5, color: 'var(--primary)',
          padding: '2px 10px', background: 'var(--primary-glow)',
          borderRadius: 99, border: '1px solid rgba(99,102,241,0.2)', fontWeight: 500,
        }}>
          <Clock size={11} /> {enabledDays} active day{enabledDays !== 1 ? 's' : ''}
        </span>

        {/* Quick-set buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => setDays(DAYS.map((_, i) => i >= 1 && i <= 5 ? [DEFAULT_BLOCK()] : []))}>
            Weekdays
          </button>
          <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => setDays(DAYS.map(() => [DEFAULT_BLOCK()]))}>
            Every day
          </button>
          <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => setDays(DAYS.map(() => []))}>
            Clear
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DAYS.map((dayName, dow) => {
            const blocks = days[dow];
            const dayEnabled = blocks.length > 0 && blocks.some((b) => b.is_active);

            return (
              <div key={dayName} className="card" style={{
                overflow: 'hidden',
                opacity: !dayEnabled ? 0.55 : 1,
                transition: 'opacity 0.2s',
              }}>
                {/* Day header row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 20px',
                  borderBottom: blocks.length > 0 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  {/* Toggle */}
                  <button
                    onClick={() => toggleDay(dow)}
                    style={{
                      width: 42, height: 23, borderRadius: 12, border: 'none',
                      background: dayEnabled ? 'var(--primary-dark)' : 'var(--border)',
                      cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3, width: 17, height: 17,
                      borderRadius: '50%', background: 'white', transition: 'left 0.2s',
                      left: dayEnabled ? 22 : 3,
                    }} />
                  </button>

                  <span style={{ fontWeight: 600, fontSize: 14, minWidth: 90 }}>{dayName}</span>

                  <span style={{ fontSize: 12, color: 'var(--muted)', flex: 1 }}>
                    {dayEnabled
                      ? blocks.filter((b) => b.is_active).map((b) => `${fmt12(b.start_time)} – ${fmt12(b.end_time)}`).join(', ')
                      : 'Unavailable'
                    }
                  </span>

                  {/* Add block button */}
                  <button
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 12, flexShrink: 0 }}
                    onClick={() => addBlock(dow)}
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>

                {/* Blocks */}
                {blocks.map((block, idx) => {
                  const invalid = errors[dow]?.[idx];
                  return (
                    <div key={block._key} style={{
                      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                      padding: '12px 20px',
                      borderBottom: idx < blocks.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      background: block.is_active ? 'transparent' : 'var(--surface)',
                    }}>
                      {/* Active toggle for individual block */}
                      <button
                        title={block.is_active ? 'Disable this block' : 'Enable this block'}
                        onClick={() => updateBlock(dow, idx, { is_active: !block.is_active })}
                        style={{
                          width: 8, height: 8, borderRadius: '50%', border: 'none',
                          background: block.is_active ? 'var(--primary-dark)' : 'var(--border)',
                          cursor: 'pointer', flexShrink: 0, outline: 'none',
                          boxShadow: block.is_active ? '0 0 6px var(--primary-dark)' : 'none',
                        }}
                      />

                      {/* Label */}
                      <input
                        type="text"
                        value={block.label}
                        onChange={(e) => updateBlock(dow, idx, { label: e.target.value })}
                        placeholder="Label (e.g. Morning)"
                        style={{
                          width: 110, padding: '6px 10px', border: '1px solid var(--border)',
                          borderRadius: 6, background: 'var(--surface)', color: 'var(--text)',
                          fontSize: 12, fontFamily: 'inherit',
                        }}
                      />

                      {/* Time selects */}
                      <select
                        className="form-input"
                        style={{ flex: 1, minWidth: 100, cursor: 'pointer', fontSize: 13 }}
                        value={block.start_time}
                        onChange={(e) => updateBlock(dow, idx, { start_time: e.target.value })}
                      >
                        {TIME_OPTIONS.map((t) => <option key={t} value={t}>{fmt12(t)}</option>)}
                      </select>

                      <span style={{ color: 'var(--muted)', fontSize: 13, flexShrink: 0 }}>–</span>

                      <select
                        className="form-input"
                        style={{ flex: 1, minWidth: 100, cursor: 'pointer', fontSize: 13 }}
                        value={block.end_time}
                        onChange={(e) => updateBlock(dow, idx, { end_time: e.target.value })}
                      >
                        {TIME_OPTIONS.map((t) => <option key={t} value={t}>{fmt12(t)}</option>)}
                      </select>

                      {invalid && (
                        <span style={{ fontSize: 11, color: 'var(--danger)', flexShrink: 0 }}>
                          End must be after start
                        </span>
                      )}

                      {/* Remove block */}
                      <button
                        onClick={() => removeBlock(dow, idx)}
                        style={{
                          background: 'transparent', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                          color: 'var(--danger)', display: 'flex', alignItems: 'center',
                          flexShrink: 0, transition: 'background 0.15s',
                        }}
                        title="Remove this block"
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--danger-bg)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 20, flexWrap: 'wrap' }}>
        <button
          className="btn-primary"
          onClick={() => save.mutate()}
          disabled={save.isPending || hasErrors}
          style={{ minWidth: 180 }}
        >
          {save.isPending && <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />}
          {save.isPending ? 'Saving…' : 'Save Availability'}
        </button>
        {hasErrors && (
          <span style={{ fontSize: 13, color: 'var(--danger)' }}>Fix time errors before saving</span>
        )}
        {save.isSuccess && !hasErrors && (
          <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>✓ Saved</span>
        )}
      </div>
    </div>
  );
}
