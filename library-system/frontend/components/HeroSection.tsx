'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const deskItems = [
  {
    title: 'Borrow period',
    value: '7 days - auto reminders',
    desc: 'One-click return requests',
  },
  {
    title: 'Advanced filters',
    value: 'Author - Genre - ISBN',
    desc: 'Find books in seconds',
  },
  {
    title: 'Digital receipts',
    value: 'Instant - trackable',
    desc: 'Every borrow securely logged',
  },
];

const trendingSearches = [
  'Introduction to Programming',
  'Data Structures and Algorithms',
  'Calculus for Engineers',
  'Philippine History',
  'Business Communication',
];

export default function HeroSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/books?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden flex items-center" style={{ background: 'radial-gradient(ellipse at 20% 50%, #102b44 0%, #081c2d 42%, #071825 72%, #061320 100%)' }}>
      <div className="absolute inset-0 pointer-events-none">
        {/* Midnight-navy mesh base */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #081c2d 0%, #0d2740 35%, #092136 65%, #071825 100%)' }} />
        {/* Soft indigo corner glows */}
        <div className="absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full animate-float" style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute -right-32 -bottom-32 h-[36rem] w-[36rem] rounded-full animate-float-slow" style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.14) 0%, transparent 70%)', filter: 'blur(48px)' }} />
        <div className="absolute right-0 top-0 h-[28rem] w-[28rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(67,56,202,0.10) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        {/* Soft baby-blue glow bottom-left */}
        <div className="absolute -bottom-16 left-1/4 h-64 w-64 rounded-full animate-float" style={{ background: 'radial-gradient(circle, rgba(142,219,255,0.10) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-6 pt-8 pb-0 sm:px-10 sm:pt-10 lg:px-16 lg:pt-12 xl:pt-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-14 items-center">
          <div className="space-y-6 sm:space-y-7">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold backdrop-blur-sm animate-fade-up" style={{ borderColor: 'rgba(142,219,255,0.35)', background: 'rgba(142,219,255,0.08)', color: '#9fdfff', letterSpacing: '0.12em' }}>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: '#9fdfff' }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: '#9fdfff' }} />
              </span>
              Digital Borrowing
            </div>

            <h1 className="animate-fade-up delay-100">
              <span
                className="block text-[2rem] sm:text-[2.6rem] md:text-[3.2rem] lg:text-[4rem] xl:text-[4.6rem] hero-title-gradient"
                style={{
                  fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, "Times New Roman", serif',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 0.94,
                }}
              >
                SCSIT Library System
              </span>
              <span className="block mt-2.5 font-sans text-base sm:text-lg md:text-xl font-medium tracking-wide" style={{ color: '#9fdfff' }}>
                THE FOUNDATION OF PERPETUAL GROWTH
              </span>
            </h1>

            <p className="max-w-lg text-sm leading-relaxed font-light animate-fade-up delay-200 sm:text-base" style={{ color: 'rgba(200,220,255,0.75)' }}>
              Explore curated collections, borrow instantly, and manage your reading life with clarity.
              Search by title, author, genre, or ISBN.
            </p>

            <form onSubmit={handleSearch} className="max-w-lg animate-fade-up delay-200">
              <div ref={searchRef} className="flex flex-col gap-2.5 sm:relative sm:block">
                <input
                  type="search"
                  inputMode="search"
                  placeholder="Title, author, genre, ISBN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white backdrop-blur-xl transition-all duration-300 placeholder:text-gray-400/60 focus:outline-none focus:border-sky-400/40 focus:ring-1 focus:ring-sky-400/25 focus:bg-white/[0.08] sm:py-3.5 sm:pl-5 sm:pr-32"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-lg transition-all duration-300 active:scale-95 sm:absolute sm:right-2 sm:top-1/2 sm:px-5 sm:py-2 sm:-translate-y-1/2 sm:hover:-translate-y-[55%]"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d4af37 40%, #fbbf24 70%, #f59e0b 100%)',
                    boxShadow: '0 6px 24px rgba(212,175,55,0.32), 0 2px 6px rgba(0,0,0,0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'linear-gradient(135deg, #fbbf24 0%, #e6c45c 40%, #fcd34d 70%, #fbbf24 100%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      'linear-gradient(135deg, #f59e0b 0%, #d4af37 40%, #fbbf24 70%, #f59e0b 100%)';
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-base">Search</span>
                </button>

                {/* Trending dropdown */}
                {showDropdown && (
                  <div
                    className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl overflow-hidden"
                    style={{
                      background: 'rgba(8,14,32,0.92)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                    }}
                  >
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'rgba(159,223,255,0.76)' }}>Trending Books</p>
                    {trendingSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onMouseDown={() => {
                          setSearchQuery(term);
                          setShowDropdown(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors duration-150"
                        style={{ color: 'rgba(220,235,255,0.85)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <svg className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(159,223,255,0.7)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        {term}
                      </button>
                    ))}
                    <div className="h-2" />
                  </div>
                )}
              </div>
            </form>

            <div className="flex flex-col gap-3 animate-fade-up delay-300 sm:flex-row sm:gap-4">
              <Link
                href="/books"
                className="cta-shimmer inline-flex items-center justify-center gap-2.5 rounded-xl px-6 py-3 text-sm text-gray-900 font-bold shadow-lg active:scale-[0.98] transition-all duration-300 hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d4af37 40%, #fbbf24 70%, #f59e0b 100%)', boxShadow: '0 6px 24px rgba(212,175,55,0.32), 0 2px 6px rgba(0,0,0,0.3)' }}
              >
                Browse Collection
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs animate-fade-up delay-300" style={{ color: 'rgba(180,200,240,0.65)' }}>
              <div className="flex items-center gap-2 transition-colors duration-300 hover:text-white/80">
                <div className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                Real-time availability
              </div>
              <div className="flex items-center gap-2 transition-colors duration-300 hover:text-white/80">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: '#9fdfff' }} />
                Borrow receipts
              </div>
              <div className="flex items-center gap-2 transition-colors duration-300 hover:text-white/80">
                <div className="h-1.5 w-1.5 rounded-full bg-sky-300" />
                Smart reminders
              </div>
            </div>
          </div>

          <div className="relative hidden lg:block animate-fade-up delay-300">
            <div className="absolute -top-6 -left-6 h-32 w-24 rounded-2xl animate-float-slow opacity-25" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }} />
            <div className="absolute -bottom-8 -right-8 h-28 w-20 rounded-2xl animate-float opacity-25" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }} />

            <div className="absolute inset-0 rounded-2xl" style={{ boxShadow: '0 0 60px 16px rgba(30,58,138,0.38), 0 24px 60px rgba(0,0,0,0.55)', borderRadius: '1rem' }} />

            <div
              className="relative rounded-2xl p-5 lg:p-6 animate-float-desk"
              style={{
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.2), 0 20px 50px rgba(0,0,0,0.45)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'rgba(180,200,240,0.55)' }}>Your Library Today</p>
                  <h3 className="mt-1.5 text-lg font-semibold tracking-tight" style={{ color: '#f0f4ff' }}>Reading Desk</h3>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold backdrop-blur-sm" style={{ background: 'rgba(0,255,255,0.08)', border: '1px solid rgba(0,255,255,0.22)', color: '#00e5ff' }}>
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#00e5ff', boxShadow: '0 0 5px #00e5ff' }} />
                  Live
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {deskItems.map((item, i) => (
                  <div
                    key={item.title}
                    style={{
                      animationDelay: `${i * 90 + 120}ms`,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                    }}
                    className="rounded-xl p-4 animate-fade-up transition-all duration-300 hover:-translate-y-0.5"
                  >
                    <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'rgba(180,200,240,0.5)' }}>{item.title}</p>
                    <p className="mt-1.5 text-sm font-semibold" style={{ color: '#e8f0ff' }}>{item.value}</p>
                    <p className="mt-1 text-xs" style={{ color: 'rgba(180,200,240,0.55)' }}>{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between text-[11px]" style={{ color: 'rgba(160,185,230,0.5)' }}>
                <span>Updates in real time</span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#00e5ff', boxShadow: '0 0 5px rgba(0,229,255,0.7)' }} />
                  Online sync
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
