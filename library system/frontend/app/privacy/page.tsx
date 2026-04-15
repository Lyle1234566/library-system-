import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const sections = [
  {
    title: 'Information We Collect',
    body: 'We store account details such as name, email, and student or staff identifiers required for library operations.',
  },
  {
    title: 'How We Use Your Data',
    body: 'Your data is used for authentication, borrowing workflows, return tracking, and service notifications.',
  },
  {
    title: 'Data Retention',
    body: 'Borrowing records and audit logs are retained according to school and library policy requirements.',
  },
  {
    title: 'Security',
    body: 'We apply role-based access controls and secure API handling to protect account and borrowing information.',
  },
  {
    title: 'Contact',
    body: 'For privacy concerns, contact support through the Contact page so the team can review your request.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0b1324] text-white">
      <Navbar variant="dark" />
      <main className="pt-16">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute -left-24 -top-20 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl animate-float" />
            <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl animate-float-slow" />
          </div>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <p className="text-xs uppercase tracking-[0.35em] text-white/60 animate-fade-up">Legal</p>
            <h1 className="mt-4 text-3xl sm:text-4xl font-semibold animate-fade-up delay-100">
              Privacy Policy
            </h1>
            <p className="mt-3 text-white/70 max-w-2xl animate-fade-up delay-200">
              This policy explains how Salazar Library System handles personal information in the system.
            </p>
          </div>
        </section>

        <section className="-mt-8 relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-4 backdrop-blur-2xl">
            {sections.map((section, index) => (
              <article
                key={section.title}
                style={{ animationDelay: `${index * 90 + 120}ms` }}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-fade-up transition-all duration-300 hover:border-white/20 hover:bg-white/10"
              >
                <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
