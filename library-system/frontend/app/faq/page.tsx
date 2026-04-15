import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const faqs = [
  {
    question: 'How do I borrow a book?',
    answer:
      'Open the book details page and click borrow. Students can submit a request, then staff reviews and approves it.',
  },
  {
    question: 'How long can I keep borrowed books?',
    answer:
      'Most books are issued for 7 days. Due dates are shown in your account and on each approved receipt.',
  },
  {
    question: 'Can I request a return online?',
    answer:
      'Yes. Open your borrowed book details and send a return request. Staff will verify and complete the return.',
  },
  {
    question: 'What if I cannot log in?',
    answer:
      'Use the Forgot Password page first. If you still cannot access your account, contact library support.',
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#0b1324] text-white">
      <Navbar variant="dark" />
      <main className="pt-16">
        <section className="relative overflow-hidden bg-[#0b1324]">
          <div className="absolute inset-0">
            <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl animate-float" />
            <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl animate-float-slow" />
          </div>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <p className="text-xs uppercase tracking-[0.35em] text-white/60 animate-fade-up">Support</p>
            <h1 className="mt-4 text-3xl sm:text-4xl font-semibold animate-fade-up delay-100">
              Frequently Asked Questions
            </h1>
            <p className="mt-3 max-w-2xl text-white/70 animate-fade-up delay-200">
              Quick answers about borrowing, returns, account access, and library workflow.
            </p>
          </div>
        </section>

        <section className="-mt-8 relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="space-y-4">
            {faqs.map((item, index) => (
              <article
                key={item.question}
                style={{ animationDelay: `${index * 90 + 120}ms` }}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl animate-fade-up transition-all duration-300 hover:border-white/20 hover:bg-white/10"
              >
                <h2 className="text-lg font-semibold text-white">{item.question}</h2>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
