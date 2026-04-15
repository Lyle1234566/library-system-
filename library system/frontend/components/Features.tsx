type FeaturesProps = {
  showBookFeatures?: boolean;
};

export default function Features({ showBookFeatures = false }: FeaturesProps) {
  const features = [
    {
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 9 9 0 0114 0z"
          />
        </svg>
      ),
      title: 'Easy Search',
      description:
        'Find any book instantly with our powerful search engine. Search by title, author, ISBN, or category.',
    },
    {
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0114 0z"
          />
        </svg>
      ),
      title: 'Quick Borrowing',
      description:
        'Borrow books with just a few clicks. No more waiting in lines or filling out paperwork.',
    },
    {
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      ),
      title: 'Due Date Reminders',
      description:
        'Never miss a return date. Get automatic notifications before your books are due.',
    },
    {
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
      title: 'Secure Account',
      description:
        'Your data is protected with industry-standard security. Safe and private library experience.',
    },
  ];

  const coreBookFeatures = [
    {
      title: 'Table of Contents',
      points: [
        'Lists chapters and sections',
        'Shows page numbers for easy navigation',
      ],
    },
    {
      title: 'Preface / Introduction',
      points: [
        'Explains the purpose of the book',
        'May describe who the book is for',
        'Gives background context',
      ],
    },
    {
      title: 'About the Author',
      points: [
        'Short author biography',
        'Credentials or relevant experience',
      ],
    },
  ];

  const nonfictionFeatures = [
    'Chapter summaries',
    'Learning objectives',
    'Case studies or real-life examples',
    'Illustrations, diagrams, or photos',
    'Exercises or reflection questions',
    'Key takeaways or summary boxes',
    'Glossary of important terms',
    'References or further reading',
  ];

  const fictionFeatures = [
    'Character list',
    'Map of the story world',
    "Author's note",
    'Discussion questions (book clubs)',
    'Sneak preview of the next book',
  ];

  const academicFeatures = [
    'Learning goals',
    'Review questions',
    'Practice problems',
    'Charts and data tables',
    'Index',
    'Bibliography',
  ];

  const suggestedAdditions = [
    'Estimated reading time per chapter',
    'Difficulty level tags per section',
    'Quick recap page at the end of each chapter',
  ];
  return (
    <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: 'linear-gradient(180deg, #060e24 0%, #080f22 50%, #060b1a 100%)' }}>
      {/* Section transition top */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)' }} />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-32 top-10 h-80 w-80 rounded-full animate-float" style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full animate-float-slow" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)', filter: 'blur(48px)' }} />
      </div>
      <div className="relative max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-16">
        {/* Section Header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] animate-fade-up" style={{ border: '1px solid rgba(212,175,55,0.25)', background: 'rgba(212,175,55,0.07)', color: '#d4af37' }}>
            Core Features
          </span>
          <h2
            className="mt-4 text-2xl md:text-3xl font-bold text-balance animate-fade-up"
            style={{
              fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
              background: 'linear-gradient(160deg, #ffffff 0%, #c8d4e8 60%, #a0b4d0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Why Choose Salazar Library System?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 animate-fade-up delay-100" style={{ color: 'rgba(180,200,240,0.6)' }}>
            Experience the future of library management with our feature-rich platform
            designed for modern readers.
          </p>
        </div>

        {/* Features Grid */}
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              style={{
                animationDelay: `${index * 90 + 120}ms`,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 14px 36px rgba(0,0,0,0.28)',
              }}
              className="group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 animate-fade-up sm:p-5"
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />
                <div className="absolute -right-10 top-8 h-20 w-20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.14) 0%, transparent 70%)', filter: 'blur(16px)' }} />
                <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.09) 0%, transparent 70%)', filter: 'blur(16px)' }} />
              </div>

              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105 [&_svg]:w-5 [&_svg]:h-5"
                    style={{
                      background: 'rgba(212,175,55,0.10)',
                      border: '1px solid rgba(212,175,55,0.18)',
                      color: '#d4af37',
                      boxShadow: '0 0 16px rgba(212,175,55,0.10)',
                    }}
                  >
                    {feature.icon}
                  </div>
                  <span className="pt-0.5 text-[10px] font-semibold tracking-[0.34em]" style={{ color: 'rgba(255,255,255,0.18)' }}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-semibold leading-tight" style={{ color: '#f0f4ff' }}>
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 transition-colors duration-300" style={{ color: 'rgba(180,200,240,0.58)' }}>
                    {feature.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>

        {showBookFeatures && (
          <div className="mt-16 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-xl animate-fade-up">
            <h3 className="text-2xl font-semibold text-white">Book Features</h3>
            <p className="mt-2 text-sm text-white/70 max-w-3xl">
              Core sections and content blocks you can include in books to improve navigation,
              context, and learning value.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {coreBookFeatures.map((feature, index) => (
                <article
                  key={feature.title}
                  style={{ animationDelay: `${index * 90 + 140}ms` }}
                  className="rounded-2xl border border-white/10 bg-[#0f1a31]/70 p-4 animate-fade-up"
                >
                  <h4 className="text-base font-semibold text-white">{feature.title}</h4>
                  <ul className="mt-3 space-y-2 text-sm text-white/75">
                    {feature.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <span className="mt-[2px] text-amber-300">-</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-white/10 bg-[#0f1a31]/70 p-4">
                <h4 className="text-base font-semibold text-white">Key Features (Nonfiction / Textbooks)</h4>
                <ul className="mt-3 space-y-2 text-sm text-white/75">
                  {nonfictionFeatures.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[2px] text-emerald-300">v</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-2xl border border-white/10 bg-[#0f1a31]/70 p-4">
                <h4 className="text-base font-semibold text-white">For Fiction Books</h4>
                <ul className="mt-3 space-y-2 text-sm text-white/75">
                  {fictionFeatures.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[2px] text-sky-300">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-2xl border border-white/10 bg-[#0f1a31]/70 p-4">
                <h4 className="text-base font-semibold text-white">For Academic / Textbooks</h4>
                <ul className="mt-3 space-y-2 text-sm text-white/75">
                  {academicFeatures.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-[2px] text-violet-300">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0f1a31]/70 p-4">
              <h4 className="text-base font-semibold text-white">Suggested Additions</h4>
              <ul className="mt-3 space-y-2 text-sm text-white/75">
                {suggestedAdditions.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-[2px] text-amber-300">+</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
