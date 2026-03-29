'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEvent } from '@/lib/api';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NewEventPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', description: '', duration: 30, slug: '' });

  const create = useMutation({
    mutationFn: createEvent,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Event created!'); router.push('/events'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 50);

  return (
    <div className="page-container" style={{ maxWidth: 600 }}>
      <Link href="/events" className="btn-secondary" style={{ textDecoration: 'none', marginBottom: 24, display: 'inline-flex' }}>
        <ArrowLeft size={15} /> Back
      </Link>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, marginTop: 16 }}>New Event Type</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 32 }}>
        Create a new scheduling event for your guests to book.
      </p>

      <div className="card" style={{ padding: 32 }}>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate({ ...form, description: form.description || undefined }); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div>
            <label className="form-label">Event Title *</label>
            <input className="form-input" placeholder="30-Minute Intro Call" value={form.title} required
              onChange={(e) => {
                const t = e.target.value;
                setForm((f) => ({ ...f, title: t, slug: f.slug || autoSlug(t) }));
              }} />
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input" placeholder="A quick call to discuss your needs..." rows={3}
              value={form.description} style={{ resize: 'vertical' }}
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
              <input className="form-input" style={{ paddingLeft: 54 }} placeholder="30-min-intro" value={form.slug} required
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} />
            </div>
          </div>

          <button className="btn-primary" type="submit" disabled={create.isPending} style={{ marginTop: 8 }}>
            {create.isPending && <Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} />}
            {create.isPending ? 'Creating…' : 'Create Event Type'}
          </button>
        </form>
      </div>
    </div>
  );
}
