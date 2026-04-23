'use client';

import { useEffect, useState } from 'react';
import { booksApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { shouldShowMeetLibrarian } from '@/lib/roles';

export default function MeetLibrarian() {
  const { user, isLoading: authLoading } = useAuth();
  const [totalBooks, setTotalBooks] = useState<number | null>(null);
  const isVisible = !authLoading && shouldShowMeetLibrarian(user);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    let isActive = true;

    const fetchStats = async () => {
      const response = await booksApi.getAll();
      if (isActive && !response.error && response.data) {
        setTotalBooks(response.data.length);
      }
    };

    void fetchStats();

    return () => {
      isActive = false;
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const formatCount = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K+` : `${n}+`;

  const stats = [
    {
      value: totalBooks !== null ? formatCount(totalBooks) : '—',
      label: 'Books Managed',
    },
    { value: '20+', label: 'Years of Service' },
    { value: '100%', label: 'Dedicated' },
  ];
  return (
    <section
      className="relative overflow-hidden py-16 sm:py-20"
      style={{ background: 'linear-gradient(180deg, #071825 0%, #081c2d 50%, #0b2134 100%)' }}
    >
      {/* Top divider */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(142,219,255,0.3), transparent)' }} />

      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-1/3 h-96 w-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(142,219,255,0.10) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.10) 0%, transparent 70%)', filter: 'blur(50px)' }} />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-6 sm:px-10 lg:px-16">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">

          {/* Image side */}
          <div className="relative flex justify-center lg:justify-start">
            {/* Decorative frame rings */}
            <div className="absolute -inset-4 rounded-[2rem] opacity-30" style={{ background: 'linear-gradient(135deg, rgba(142,219,255,0.16), rgba(79,70,229,0.10))', border: '1px solid rgba(142,219,255,0.16)' }} />
            <div className="absolute -inset-2 rounded-[1.8rem] opacity-20" style={{ border: '1px solid rgba(255,255,255,0.08)' }} />

            {/* Photo container */}
            <div
              className="relative overflow-hidden rounded-[1.6rem] shadow-2xl"
              style={{
                border: '1px solid rgba(142,219,255,0.24)',
                boxShadow: '0 0 60px rgba(142,219,255,0.14), 0 32px 80px rgba(0,0,0,0.6)',
                maxWidth: '480px',
                width: '100%',
              }}
            >
              {/* Gold overlay tint at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-32 z-10" style={{ background: 'linear-gradient(to top, rgba(6,11,26,0.7), transparent)' }} />

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/librarian.jpg"
                alt="Meet your librarian"
                className="w-full object-cover"
                style={{ aspectRatio: '4/3' }}
              />

              {/* Live badge */}
              <div className="absolute bottom-4 left-4 z-20 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold backdrop-blur-md" style={{ background: 'rgba(6,11,26,0.75)', border: '1px solid rgba(142,219,255,0.30)', color: '#9fdfff' }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#9fdfff', boxShadow: '0 0 6px #9fdfff' }} />
                SCSIT Library System
              </div>
            </div>
          </div>

          {/* Text side */}
          <div className="space-y-6">
            {/* Eyebrow */}
            <span
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em]"
              style={{ border: '1px solid rgba(142,219,255,0.25)', background: 'rgba(142,219,255,0.07)', color: '#9fdfff' }}
            >
              <span className="h-1 w-1 rounded-full" style={{ background: '#9fdfff' }} />
              Meet Your Librarian
            </span>

            {/* Heading */}
            <h2
              className="text-3xl font-bold leading-tight sm:text-4xl"
              style={{
                fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
                background: 'linear-gradient(160deg, #ffffff 0%, #c8d4e8 60%, #a0b4d0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              The Heart Behind<br />Every Borrowed Book
            </h2>

            {/* Divider */}
            <div className="h-px w-16" style={{ background: 'linear-gradient(90deg, #9fdfff, transparent)' }} />

            {/* Description */}
            <p className="text-sm leading-7 sm:text-base" style={{ color: 'rgba(180,200,240,0.72)' }}>
              With decades of dedication to knowledge and learning, our librarian is the
              cornerstone of the SCSIT Library System. She curates every collection, guides every
              reader, and ensures that every student finds exactly what they need.
            </p>

            <p className="text-sm leading-7" style={{ color: 'rgba(180,200,240,0.55)' }}>
              From managing thousands of titles to personally assisting borrowers, her
              commitment to education and literacy is what makes this library truly special.
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-4 text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <p className="text-xl font-bold" style={{ color: '#9fdfff' }}>
                    {stat.label === 'Books Managed' && totalBooks === null
                      ? <span className="inline-block h-5 w-12 animate-pulse rounded bg-white/10" />
                      : stat.value}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.2em]" style={{ color: 'rgba(180,200,240,0.5)' }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Quote */}
            <blockquote
              className="rounded-2xl p-5 text-sm italic leading-7"
              style={{
                background: 'rgba(142,219,255,0.05)',
                border: '1px solid rgba(142,219,255,0.15)',
                color: 'rgba(210,242,255,0.88)',
              }}
            >
              &ldquo;A library is not just a room full of books &mdash; it is a gateway to every`r`n              world imaginable. My mission is to open that gateway for every student who walks`r`n              through our doors.&rdquo;
            </blockquote>
          </div>
        </div>
      </div>

      {/* Bottom divider */}
      <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.25), transparent)' }} />
    </section>
  );
}
