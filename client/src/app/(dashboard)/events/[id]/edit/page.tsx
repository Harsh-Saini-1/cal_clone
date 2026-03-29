'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvents, updateEvent } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: getEvents });
  const event = events.find((e) => e.id === id);
  const [form, setForm] = useState({ title: '', description: '', duration: 30, slug: '' });

  useEffect(() => {
    if (event) setForm({ title: event.title, description: event.description ?? '', duration: event.duration, slug: event.slug });
  }, [event]);

  const update = useMutation({
    mutationFn: (data: typeof form) => updateEvent(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Event updated!'); router.push('/events'); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!event) return <div className="page-container"><div className="spinner" /></div>;

  return (
    <div className="page-container" style={{ maxWidth: 600 }}>
      <Link href="/events" className="btn-secondary" style={{ textDecoration: 'none', marginBottom: 24, display: 'inline-flex' }}>
        <ArrowLeft size={15} /> Back
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, marginTop: 16 }}>Edit Event</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>Update your event type details.</p>

      <div className="card" style={{ padding: 32 }}>
        <form onSubmit={(e) => { e.preventDefault(); update.mutate(form); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <label className="form-label">Event Title *</label>
            <input className="form-input" value={form.title} required
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={3} value={form.description} style={{ resize: 'vertical' }}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>

          <div>
            <label className="form-label">Duration *</label>
            <select className="form-input" value={form.duration}
              onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}>
              {[15, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">URL Slug *</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--muted)', fontSize: 14, pointerEvents: 'none' }}>/book/</span>
              <input className="form-input" style={{ paddingLeft: 54 }} value={form.slug} required
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
            </div>
          </div>

          <button className="btn-primary" type="submit" disabled={update.isPending} style={{ marginTop: 8 }}>
            {update.isPending && <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {update.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
