import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[#0b1424] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4 flex items-center space-x-2">
              <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/20">
                <Image
                  src="/logo%20lib.png"
                  alt="Salazar Library System logo"
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>
              <span className="text-xl font-semibold">Salazar Library System</span>
            </div>
            <p className="text-white/70 max-w-md">
              Salazar Library System is designed to streamline book management,
              user tracking, and borrowing processes for modern libraries.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/books"
                  className="text-white/70 hover:text-[color:var(--accent)] transition-colors"
                >
                  Browse Books
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-white/70 hover:text-[color:var(--accent)] transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="/features"
                  className="text-white/70 hover:text-[color:var(--accent)] transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-white/70 hover:text-[color:var(--accent)] transition-colors"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-white/70 hover:text-[color:var(--accent)] transition-colors"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-2 text-white/70">
              <li className="flex items-start space-x-2">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="break-all">SalazarLibrary@gmail.com</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                <span>+63 9696123641</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-sm leading-6">211 Natalio B. Bacalso Ave, Cebu City, 6000 Cebu</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 md:flex-row md:items-center">
          <p className="text-white/60 text-sm">
            (c) {new Date().getFullYear()} Salazar Library System. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-4 sm:gap-6">
            <Link
              href="/privacy"
              className="text-white/60 hover:text-[color:var(--accent)] text-sm transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-white/60 hover:text-[color:var(--accent)] text-sm transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
