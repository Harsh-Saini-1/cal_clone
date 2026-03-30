'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvents, deleteEvent } from '@/lib/api';
import { Plus, Clock, Link2, Trash2, Pencil, Calendar, CalendarX2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import type { EventType } from '@/types';

export default function EventsPage() {
  const qc = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
  });

  const remove = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Event deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Event Types</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>Manage your schedulable events</p>
        </div>
        <Link href="/events/new" className="btn-primary" style={{ textDecoration: 'none' }}>
          <Plus size={16} /> New Event
        </Link>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : events.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <Calendar size={40} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontWeight: 500, marginBottom: 8 }}>No event types yet</p>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
            Create your first event type to start accepting bookings
          </p>
          <Link href="/events/new" className="btn-primary" style={{ textDecoration: 'none' }}>
            <Plus size={15} /> Create Event
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.map((e: EventType) => (
            <div key={e.id} className="card event-card">
              {/* Top row: accent bar + info */}
              <div className="event-card-body">
                <div style={{ width: 4, alignSelf: 'stretch', background: 'var(--primary-dark)', borderRadius: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{e.title}</h3>
                  <div style={{ display: 'flex', gap: 18, fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} /> {e.duration} min
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                      <Link2 size={13} />
                      <Link
                        href={`/book?event=${e.slug}`}
                        style={{ color: 'var(--primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        /book/{e.slug}
                      </Link>
                    </span>
                  </div>
                </div>
                {/* Actions – shown inline on desktop */}
                <div className="event-card-actions event-card-actions--desktop">
                  <Link href={`/events/${e.id}/availability`} className="btn-secondary"
                    style={{ textDecoration: 'none', fontSize: 13, padding: '6px 12px' }}>
                    <Calendar size={13} /> Availability
                  </Link>
                  <Link href={`/events/${e.id}/overrides`} className="btn-secondary"
                    style={{ textDecoration: 'none', fontSize: 13, padding: '6px 12px' }}>
                    <CalendarX2 size={13} /> Overrides
                  </Link>
                  <Link href={`/events/${e.id}/edit`} className="btn-secondary"
                    style={{ textDecoration: 'none', fontSize: 13, padding: '6px 12px' }}>
                    <Pencil size={13} /> Edit
                  </Link>
                  <button className="btn-danger" style={{ fontSize: 13, padding: '6px 12px' }}
                    onClick={() => { if (window.confirm('Delete this event? All bookings will also be removed.')) remove.mutate(e.id); }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Actions – shown below info on mobile */}
              <div className="event-card-actions event-card-actions--mobile">
                <Link href={`/events/${e.id}/availability`} className="btn-secondary"
                  style={{ textDecoration: 'none', fontSize: 13, padding: '8px 12px', flex: '0 0 100%', justifyContent: 'center' }}>
                  <Calendar size={14} /> Availability
                </Link>
               <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <Link href={`/events/${e.id}/overrides`} className="btn-secondary"
                    style={{ textDecoration: 'none', fontSize: 13, padding: '8px 12px', flex: 2, justifyContent: 'center', minWidth: 0 }}>
                    <CalendarX2 size={14} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Overrides</span>
                  </Link>
                  <Link href={`/events/${e.id}/edit`} className="btn-secondary"
                    style={{ textDecoration: 'none', fontSize: 13, padding: '8px 12px', flex: 1.5, justifyContent: 'center', minWidth: 0 }}>
                    <Pencil size={14} /> Edit
                  </Link>
                  <button className="btn-danger" style={{ fontSize: 13, padding: '8px 12px', flex: 1, justifyContent: 'center' }}
                    onClick={() => { if (window.confirm('Delete this event? All bookings will also be removed.')) remove.mutate(e.id); }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {/* <button className="btn-danger" style={{ fontSize: 13, padding: '6px 12px' }}
                  onClick={() => { if (window.confirm('Delete this event? All bookings will also be removed.')) remove.mutate(e.id); }}>
                  <Trash2 size={13} />
                </button> */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
