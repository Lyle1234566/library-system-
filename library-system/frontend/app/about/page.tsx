import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LibraryLocationSection from '@/components/LibraryLocationSection';
import AboutStatsGrid from '@/components/AboutStatsGrid';

const goals = [
  'Deliver a calm, reliable borrowing experience for every student.',
  'Keep availability transparent and updates instant.',
  'Make returning and renewals easy to understand.',
  'Support librarians with accurate, organized tools.',
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0b1324] text-white">
      <Navbar variant="dark" />
      <main className="pt-16">
        <section className="relative overflow-hidden bg-[#0b1324] text-white">
          <div className="absolute inset-0">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl animate-float" />
            <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-amber-500/20 blur-3xl animate-float-slow" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.18),transparent_45%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_70%,rgba(251,191,36,0.16),transparent_50%)]" />
          </div>
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <p className="text-xs uppercase tracking-[0.5em] text-white/60 animate-fade-up">About Us</p>
            <h1 className="mt-4 text-3xl sm:text-4xl font-semibold animate-fade-up delay-100">
              A calmer, smarter way to manage your library
            </h1>
            <p className="mt-4 text-white/70 max-w-2xl animate-fade-up delay-200">
              SCSIT Library System blends thoughtful design with dependable systems so students can spend
              less time waiting and more time reading.
            </p>
            <AboutStatsGrid />
          </div>
        </section>

        <section className="-mt-12 sm:-mt-16 relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/50 p-6 sm:p-10 space-y-10 backdrop-blur-2xl animate-fade-up delay-100">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 animate-fade-up delay-100 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10">
                <p className="text-xs uppercase tracking-widest text-white/60">Mission</p>
                <h2 className="mt-3 text-xl font-semibold text-white">
                  Make borrowing feel simple, clear, and welcoming.
                </h2>
                <p className="mt-4 text-sm text-white/70 leading-relaxed">
                  We remove friction from everyday library tasks so students can browse quickly,
                  track requests, and always know the next step.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 animate-fade-up delay-200 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10">
                <p className="text-xs uppercase tracking-widest text-white/60">Vision</p>
                <h2 className="mt-3 text-xl font-semibold text-white">
                  A library experience that feels calm, smart, and human.
                </h2>
                <p className="mt-4 text-sm text-white/70 leading-relaxed">
                  We aim to build a digital library environment that keeps learning accessible,
                  organized, and supportive for every reader.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 animate-fade-up delay-300 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10">
                <p className="text-xs uppercase tracking-widest text-white/60">Goals</p>
                <ul className="mt-4 space-y-3 text-sm text-white/70">
                  {goals.map((goal, index) => (
                    <li
                      key={goal}
                      style={{ animationDelay: `${index * 70 + 140}ms` }}
                      className="flex items-start gap-3 animate-fade-up transition-colors duration-300 hover:text-white/85"
                    >
                      <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <LibraryLocationSection />

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up delay-300 transition-all duration-300 hover:border-white/20 hover:bg-white/10">
              <div>
                <h3 className="text-xl font-semibold text-white">Ready to explore the collection?</h3>
                <p className="mt-2 text-sm text-white/70">
                  Browse books, track your requests, and build your reading list in minutes.
                </p>
              </div>
              <Link
                href="/books"
                className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-[#1a1b1f] shadow-[0_16px_34px_rgba(212,175,55,0.28),0_4px_10px_rgba(0,0,0,0.24)] transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d4af37 40%, #fbbf24 70%, #f59e0b 100%)',
                }}
              >
                Browse books
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
