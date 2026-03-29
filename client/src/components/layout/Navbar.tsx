'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, CalendarDays, Calendar, ExternalLink, Menu, X, Sun, Moon } from 'lucide-react';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/events', label: 'Event Types', icon: CalendarDays },
];

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // On mount, read saved preference (or system preference)
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'light';
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
    }
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return { theme, toggle };
}

export default function Navbar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();

  // Close drawer on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (drawerOpen && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [drawerOpen]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  const isDark = theme === 'dark';

  return (
    <>
      {/* ── Top Navbar ── */}
      <header className="navbar-root">
        {/* Hamburger (mobile only) */}
        <button
          id="navbar-hamburger"
          className="hamburger-btn"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu size={22} />
        </button>

        {/* Logo – always visible */}
        <Link href="/" className="navbar-logo" aria-label="CalClone home">
          <div className="navbar-logo-icon">
            <Calendar size={18} color="white" />
          </div>
          <span className="navbar-logo-text">CalClone</span>
        </Link>

        {/* Desktop nav links – centered */}
        <nav className="navbar-links-desktop" aria-label="Main navigation">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`navbar-link${isActive(href) ? ' navbar-link--active' : ''}`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right slot: theme toggle + public booking badge */}
        <div className="navbar-right">
          {/* Theme toggle button */}
          <button
            id="theme-toggle-btn"
            onClick={toggle}
            className="theme-toggle-btn"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark
              ? <Sun size={16} strokeWidth={2} />
              : <Moon size={16} strokeWidth={2} />
            }
          </button>

          {/* Book Now — navigates to public booking page */}
          <Link
            href="/book"
            className="navbar-public-badge"
            style={{ textDecoration: 'none' }}
          >
            <ExternalLink size={11} />
            <span>Book Now</span>
          </Link>
        </div>
      </header>

      {/* ── Mobile Drawer Overlay ── */}
      {drawerOpen && (
        <div className="drawer-overlay" aria-hidden="true" />
      )}

      {/* ── Mobile Drawer ── */}
      <div
        ref={drawerRef}
        className={`drawer${drawerOpen ? ' drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Drawer header */}
        <div className="drawer-header">
          <div className="navbar-logo">
            <div className="navbar-logo-icon">
              <Calendar size={18} color="white" />
            </div>
            <span className="navbar-logo-text">CalClone</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Theme toggle in drawer header too */}
            <button
              onClick={toggle}
              className="theme-toggle-btn"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark
                ? <Sun size={15} strokeWidth={2} />
                : <Moon size={15} strokeWidth={2} />
              }
            </button>
            <button
              className="drawer-close-btn"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Drawer nav links */}
        <nav className="drawer-nav" aria-label="Mobile navigation">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`drawer-link${isActive(href) ? ' drawer-link--active' : ''}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        {/* Drawer footer — Book Now link */}
        <div className="drawer-footer">
          <p className="drawer-footer-label">Public booking</p>
          <Link
            href="/book"
            onClick={() => setDrawerOpen(false)}
            className="navbar-public-badge"
            style={{ textDecoration: 'none', justifyContent: 'center' }}
          >
            <ExternalLink size={11} />
            <span>Book Now</span>
          </Link>
        </div>
      </div>
    </>
  );
}
