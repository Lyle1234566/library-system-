import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const terms = [
  {
    title: 'Account Responsibility',
    body: 'Users are responsible for safeguarding their credentials and for activities performed under their account.',
  },
  {
    title: 'Borrowing Rules',
    body: 'Borrow requests are subject to library approval. Return deadlines and status decisions are managed by staff.',
  },
  {
    title: 'Acceptable Use',
    body: 'Users must not misuse the platform, access unauthorized data, or interfere with system operations.',
  },
  {
    title: 'System Availability',
    body: 'Service may be updated or temporarily unavailable for maintenance or operational improvements.',
  },
  {
    title: 'Policy Updates',
    body: 'Terms can be updated when required. Continued use of the platform means acceptance of revised terms.',
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0b1324] text-white">
      <Navbar variant="dark" />
      <main className="pt-16">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl animate-float" />
            <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl animate-float-slow" />
          </div>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <p className="text-xs uppercase tracking-[0.35em] text-white/60 animate-fade-up">Legal</p>
            <h1 className="mt-4 text-3xl sm:text-4xl font-semibold animate-fade-up delay-100">
              Terms of Service
            </h1>
            <p className="mt-3 text-white/70 max-w-2xl animate-fade-up delay-200">
              These terms define the rules for using the SCSIT Library System platform.
            </p>
          </div>
        </section>

        <section className="-mt-8 relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-4 backdrop-blur-2xl">
            {terms.map((term, index) => (
              <article
                key={term.title}
                style={{ animationDelay: `${index * 90 + 120}ms` }}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-fade-up transition-all duration-300 hover:border-white/20 hover:bg-white/10"
              >
                <h2 className="text-lg font-semibold text-white">{term.title}</h2>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">{term.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
