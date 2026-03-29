'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Calendar, ExternalLink } from 'lucide-react';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/events', label: 'Event Types', icon: CalendarDays },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 240, minHeight: '100vh', background: 'var(--surface)',
      borderRight: '1px solid var(--border)', display: 'flex',
      flexDirection: 'column', padding: '24px 12px', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 12px', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: 'var(--primary-dark)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Calendar size={18} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>CalClone</span>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderRadius: 8, fontSize: 14, fontWeight: active ? 600 : 400,
              color: active ? 'var(--primary)' : 'var(--muted-lighter)',
              background: active ? 'var(--primary-glow)' : 'transparent',
              textDecoration: 'none', transition: 'all 0.15s',
            }}>
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer hint */}
      <div style={{ marginTop: 'auto', padding: '0 12px' }}>
        <div style={{ padding: 12, background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Public booking
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <ExternalLink size={11} color="var(--primary)" />
            <span style={{ color: 'var(--primary)' }}>/book/[slug]</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
