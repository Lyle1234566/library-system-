import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';

type CatalogAccessPromptProps = {
  loginHref: string;
  title?: string;
  description?: string;
  eyebrow?: string;
  compact?: boolean;
};

export default function CatalogAccessPrompt({
  loginHref,
  title = 'Sign in to view the library catalog',
  description = 'Book covers, availability, and borrowing actions are available only after account sign in.',
  eyebrow = 'Catalog Access',
  compact = false,
}: CatalogAccessPromptProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[0_24px_60px_rgba(2,6,23,0.45)] ${
        compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'
      }`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-sky-400/12 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center rounded-full border border-sky-300/20 bg-sky-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-100">
          {eyebrow}
        </span>
        <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/12 bg-white/[0.06] text-sky-100 shadow-[0_12px_28px_rgba(14,165,233,0.15)]">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className={`mt-5 font-semibold text-white ${compact ? 'text-2xl sm:text-[1.9rem]' : 'text-3xl sm:text-4xl'}`}>
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/68 sm:text-base">
          {description}
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={loginHref}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[#1a1b1f] transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d4af37 40%, #fbbf24 70%, #f59e0b 100%)',
              boxShadow: '0 6px 24px rgba(212,175,55,0.32), 0 2px 6px rgba(0,0,0,0.3)',
            }}
          >
            Sign in to continue
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white/82 transition-all hover:-translate-y-0.5 hover:bg-white/[0.08] hover:text-white"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
