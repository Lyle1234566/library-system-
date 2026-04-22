'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function CallToAction() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || isAuthenticated) {
    return null;
  }

  return (
    <section
      className="relative overflow-hidden py-20 sm:py-28"
      style={{ background: 'linear-gradient(180deg, #071825 0%, #0b2134 50%, #081c2d 100%)' }}
    >
      {/* Section transition top */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(142,219,255,0.25), transparent)' }} />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 left-1/4 h-72 w-72 rounded-full animate-float" style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.14) 0%, transparent 70%)', filter: 'blur(48px)' }} />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full animate-float-slow" style={{ background: 'radial-gradient(circle, rgba(142,219,255,0.10) 0%, transparent 70%)', filter: 'blur(48px)' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-flex items-center rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] animate-fade-up" style={{ border: '1px solid rgba(142,219,255,0.25)', background: 'rgba(142,219,255,0.07)', color: '#9fdfff' }}>
            Get Started
          </span>

          <h2
            className="mt-5 text-3xl md:text-4xl font-bold text-balance animate-fade-up"
            style={{
              fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
              background: 'linear-gradient(160deg, #ffffff 0%, #c8d4e8 60%, #a0b4d0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Ready to Start Your Reading Journey?
          </h2>

          <p className="mt-4 text-lg max-w-2xl mx-auto animate-fade-up delay-100" style={{ color: 'rgba(180,200,240,0.65)' }}>
            Join readers who want a modern borrowing experience. Create your account,
            explore the catalog, and track every receipt in one place.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up delay-200">
            {/* Primary CTA — Gold shimmer */}
            <Link
              href="/register"
              className="cta-shimmer inline-flex items-center gap-3 rounded-full px-8 py-4 font-bold text-gray-900 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d4af37 40%, #fbbf24 70%, #f59e0b 100%)',
                boxShadow: '0 8px 32px rgba(212,175,55,0.35), 0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              Create Free Account
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>

            {/* Secondary CTA — Ghost */}
            <Link
              href="/about"
              className="inline-flex items-center rounded-full px-8 py-4 font-medium backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5"
              style={{ border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.82)', background: 'rgba(255,255,255,0.04)' }}
            >
              Learn More
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4 animate-fade-up delay-300">
            {['Free to Join', 'No Credit Card Required', 'Instant Access'].map((badge) => (
              <div
                key={badge}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all duration-300 hover:-translate-y-0.5"
                style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(180,200,240,0.7)' }}
              >
                <svg className="w-4 h-4" style={{ color: '#9fdfff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
