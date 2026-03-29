'use client';

import { useSearchParams, useParams } from 'next/navigation';
import { format } from 'date-fns';
import { CheckCircle, Calendar, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ConfirmContent() {
  const { slug } = useParams<{ slug: string }>();
  const sp   = useSearchParams();
  const name  = sp.get('name')  ?? 'there';
  const start = sp.get('start');
  const title = sp.get('title') ?? 'Meeting';

  const startDate = start ? new Date(start) : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card animate-in" style={{ maxWidth: 480, width: '100%', padding: 48, textAlign: 'center' }}>

        {/* Icon */}
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--success-bg)',
          border: '1px solid rgba(74,222,128,0.25)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 24px' }}>
          <CheckCircle size={36} color="var(--success)" />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>You're booked!</h1>
        <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 36, lineHeight: 1.6 }}>
          A confirmation has been recorded for{' '}
          <strong style={{ color: 'var(--text)' }}>{decodeURIComponent(name)}</strong>.
        </p>

        {/* Event details card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 24, textAlign: 'left', marginBottom: 32 }}>
          <h2 style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>{decodeURIComponent(title)}</h2>
          {startDate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--muted-lighter)' }}>
                <Calendar size={15} color="var(--primary)" />
                <span>{format(startDate, 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--muted-lighter)' }}>
                <Clock size={15} color="var(--primary)" />
                <span>{format(startDate, 'h:mm a')} (UTC)</span>
              </div>
            </div>
          )}
        </div>

        <Link href={`/book/${slug}`} className="btn-secondary" style={{ textDecoration: 'none', justifyContent: 'center', display: 'inline-flex' }}>
          <ArrowLeft size={15} /> Book another time
        </Link>
      </div>
    </div>
  );
}
