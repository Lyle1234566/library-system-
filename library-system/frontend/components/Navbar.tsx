'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsApi, resolveMediaUrl } from '@/lib/api';
import { subscribeToUnreadCountUpdated } from '@/lib/notificationEvents';
import { getUserRoleLabel, hasStaffDeskAccess, isWorkingStudent } from '@/lib/roles';

type NavbarProps = {
  variant?: 'light' | 'dark';
};

const navItems = [
  { label: 'Home', href: '/', anchor: 'hero' },
  { label: 'Browse Books', href: '/books', anchor: null },
  { label: 'Features', href: '/features', anchor: 'features' },
  { label: 'About', href: '/about', anchor: null },
  { label: 'Contact', href: '/contact', anchor: null },
] as const;

export default function Navbar({ variant = 'light' }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const isDark = variant === 'dark';
  const showLibrarianDesk = !!user && ['LIBRARIAN', 'ADMIN'].includes(user.role);
  const showStaffDesk = hasStaffDeskAccess(user);
  const staffDeskLabel = isWorkingStudent(user) ? 'Working Student Desk' : 'Staff Desk';
  const roleLabel = getUserRoleLabel(user);
  const displayId = user?.staff_id || user?.student_id || '-';
  const displayIdLabel = user?.staff_id
    ? user?.role === 'LIBRARIAN' || user?.role === 'TEACHER'
      ? 'Faculty ID'
      : 'Staff ID'
    : 'Student ID';

  const isOnHome = pathname === '/';

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, anchor: string | null) => {
    if (!anchor || !isOnHome) return;
    e.preventDefault();
    const el = document.getElementById(anchor);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const isNavItemActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const getNavLinkClasses = (href: string, mobile = false) => {
    const isActive = isNavItemActive(href);
    const baseClasses = mobile
      ? 'group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium tracking-[0.01em] transition-all duration-300'
      : 'group relative inline-flex items-center rounded-full px-4.5 py-2.5 text-[0.92rem] font-medium tracking-[0.01em] transition-all duration-300';

    if (isDark) {
      return `${baseClasses} ${
        isActive
          ? 'bg-white/[0.08] text-sky-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.18)]'
          : 'text-white/68 hover:bg-white/[0.045] hover:text-sky-200'
      }`;
    }

    return `${baseClasses} ${
      isActive
        ? 'bg-[color:var(--surface-muted)] text-[color:var(--accent-cool-strong)] shadow-[inset_0_0_0_1px_rgba(14,165,233,0.12)]'
        : 'text-ink-muted hover:bg-white/80 hover:text-[color:var(--accent-cool-strong)]'
    }`;
  };

  const getNavIndicatorClasses = (href: string) => {
    const isActive = isNavItemActive(href);
    return isDark
      ? isActive
        ? 'opacity-100 scale-100 bg-gradient-to-r from-transparent via-sky-300 to-transparent shadow-[0_0_20px_rgba(56,189,248,0.55)]'
        : 'opacity-0 scale-75 bg-gradient-to-r from-transparent via-sky-300/80 to-transparent group-hover:opacity-100 group-hover:scale-100'
      : isActive
        ? 'opacity-100 scale-100 bg-gradient-to-r from-transparent via-sky-500 to-transparent'
        : 'opacity-0 scale-75 bg-gradient-to-r from-transparent via-sky-500/70 to-transparent group-hover:opacity-100 group-hover:scale-100';
  };

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const closeMenusFrame = requestAnimationFrame(() => {
      setIsMenuOpen(false);
      setIsProfileOpen(false);
    });

    return () => cancelAnimationFrame(closeMenusFrame);
  }, [pathname]);

  useEffect(() => {
    let isActive = true;

    const loadUnreadCount = async () => {
      if (!isAuthenticated) {
        setUnreadCount(0);
        return;
      }

      const response = await notificationsApi.getUnreadCount();
      if (!isActive || response.error || !response.data) {
        return;
      }

      setUnreadCount(response.data.unread_count ?? 0);
    };

    void loadUnreadCount();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, pathname]);

  useEffect(() => {
    return subscribeToUnreadCountUpdated((nextUnreadCount) => {
      setUnreadCount(nextUnreadCount);
    });
  }, []);

  const handleLogout = () => {
    logout();
    setUnreadCount(0);
    setIsProfileOpen(false);
    setIsMenuOpen(false);
  };

  const avatarUrl = user?.avatar ? resolveMediaUrl(user.avatar) : null;
  const defaultAvatarUrl = '/student-avatar.svg';
  const dropdownPanelClasses = isDark
    ? 'bg-white border border-slate-200 shadow-[0_24px_60px_rgba(15,23,42,0.22)]'
    : 'bg-paper border border-line shadow-card';
  const dropdownBorderClasses = isDark ? 'border-slate-200' : 'border-line';
  const dropdownPrimaryTextClasses = isDark ? 'text-slate-900' : 'text-ink';
  const dropdownSecondaryTextClasses = isDark ? 'text-slate-500' : 'text-ink-muted';
  const dropdownBadgeClasses = isDark
    ? 'bg-sky-100 text-slate-800'
    : 'bg-[color:var(--surface-muted)] text-ink';
  const dropdownItemClasses = isDark
    ? 'flex items-center px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 transition-colors'
    : 'flex items-center px-4 py-2 text-sm text-ink hover:bg-[color:var(--surface-muted)] transition-colors';
  const dropdownSignOutClasses = isDark
    ? 'flex items-center w-full px-4 py-2 text-sm text-rose-500 hover:bg-slate-50 transition-colors'
    : 'flex items-center w-full px-4 py-2 text-sm text-rose-600 hover:bg-[color:var(--surface-muted)] transition-colors';

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b shadow-[var(--nav-shadow)] ${
        isDark
          ? 'border-white/8 bg-[linear-gradient(180deg,rgba(4,12,31,0.60)_0%,rgba(10,18,38,0.58)_48%,rgba(13,24,48,0.56)_100%)] shadow-[0_20px_60px_rgba(2,8,23,0.28)]'
          : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(245,249,255,0.93)_100%)] border-line'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={`absolute inset-x-0 bottom-0 h-px ${
            isDark
              ? 'bg-gradient-to-r from-transparent via-sky-300/30 to-transparent'
              : 'bg-gradient-to-r from-transparent via-sky-500/20 to-transparent'
          }`}
        />
        <div
          className={`absolute left-[12%] top-[-8rem] h-56 w-56 rounded-full blur-3xl ${
            isDark ? 'bg-sky-500/12' : 'bg-sky-500/8'
          }`}
        />
        <div
          className={`absolute right-[10%] top-[-9rem] h-64 w-64 rounded-full blur-3xl ${
            isDark ? 'bg-cyan-400/8' : 'bg-cyan-400/6'
          }`}
        />
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative flex min-w-0 items-center justify-between gap-3 py-3 sm:h-[4.7rem] sm:py-0">
          {/* Logo */}
          <Link href="/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div
              className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border shadow-soft sm:h-14 sm:w-14 ${
                isDark ? 'border-white/15 bg-white/[0.04]' : 'border-white/70 bg-white/80'
              }`}
            >
              <Image
                src="/logo%20lib.png"
                alt="Salazar Library System logo"
                fill
                sizes="(min-width: 640px) 56px, 48px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 leading-tight">
              <span className={`block truncate text-[0.98rem] font-semibold tracking-tight sm:text-[1.08rem] ${isDark ? 'text-white' : 'text-ink'}`}>
                Salazar Library System
              </span>
              <span className={`hidden sm:block text-[0.62rem] font-medium uppercase tracking-[0.34em] ${isDark ? 'text-white/42' : 'text-ink-muted/75'}`}>
                Salazar Library System
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div
            className={`hidden md:flex items-center gap-1 rounded-full px-2.5 py-1.5 ${
              isDark
                ? 'bg-white/[0.028] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                : 'bg-white/88 shadow-[0_12px_30px_rgba(15,23,42,0.06)]'
            }`}
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.anchor)}
                className={getNavLinkClasses(item.href)}
                aria-current={isNavItemActive(item.href) ? 'page' : undefined}
              >
                <span>{item.label}</span>
                <span className={`pointer-events-none absolute inset-x-4 -bottom-px h-px rounded-full transition-all duration-300 ${getNavIndicatorClasses(item.href)}`} />
              </Link>
            ))}
          </div>

          {/* Auth Section */}
          <div className="hidden md:flex items-center space-x-4">
            {isLoading ? (
              <div className={`h-10 w-10 rounded-full animate-pulse ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}></div>
            ) : isAuthenticated && user ? (
              /* Authenticated User - Profile Dropdown */
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className={`relative flex items-center space-x-2 rounded-full border px-2 py-1.5 transition-all focus:outline-none ${
                    isDark
                      ? 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'
                      : 'border-white/80 bg-white/85 hover:bg-white'
                  }`}
                >
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-[#10203a] shadow-[0_10px_24px_rgba(251,191,36,0.35)]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white font-semibold overflow-hidden" style={{ boxShadow: '0 0 0 2px rgba(56,189,248,0.7), 0 0 10px rgba(56,189,248,0.3)' }}>
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt={user.full_name} className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={defaultAvatarUrl}
                        alt={user.full_name ? `${user.full_name} profile` : 'Student profile'}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <svg
                    className={`w-4 h-4 text-ink-muted transition-transform ${
                      isProfileOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Profile Dropdown Menu */}
                {isProfileOpen && (
                  <div className={`absolute right-0 mt-2 w-56 rounded-[1.6rem] py-2 z-50 ${dropdownPanelClasses}`}>
                    {/* User Info */}
                    <div className={`px-4 py-3 border-b ${dropdownBorderClasses}`}>
                      <p className={`text-sm font-semibold truncate ${dropdownPrimaryTextClasses}`}>
                        {user.full_name}
                      </p>
                      <p className={`text-sm truncate ${dropdownSecondaryTextClasses}`}>
                        {displayIdLabel}: {displayId}
                      </p>
                      <span className={`inline-block mt-2 rounded-full px-2.5 py-1 text-xs font-semibold ${dropdownBadgeClasses}`}>
                        {roleLabel}
                      </span>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <Link
                        href="/profile"
                        className={dropdownItemClasses}
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile
                      </Link>
                      <Link
                        href="/notifications"
                        className={dropdownItemClasses}
                        onClick={() => setIsProfileOpen(false)}
                      >
                        <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Notifications
                        {unreadCount > 0 && (
                          <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-[#10203a]">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </Link>
                      {showLibrarianDesk && (
                        <Link
                          href="/librarian"
                          className={dropdownItemClasses}
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 0a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Librarian Desk
                        </Link>
                      )}
                      {showStaffDesk && (
                        <Link
                          href="/staff"
                          className={dropdownItemClasses}
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5s-3 1.343-3 3 1.343 3 3 3zm0 2c-2.761 0-5 2.239-5 5h10c0-2.761-2.239-5-5-5z" />
                          </svg>
                          {staffDeskLabel}
                        </Link>
                      )}
                    </div>

                    {/* Logout */}
                    <div className={`border-t py-1 ${dropdownBorderClasses}`}>
                      <button
                        onClick={handleLogout}
                        className={dropdownSignOutClasses}
                      >
                        <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Not Authenticated - Login/Register Buttons */
            <>
            <Link
                href="/login"
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  isDark
                    ? 'text-white/72 hover:bg-white/[0.05] hover:text-sky-200'
                    : 'text-ink-muted hover:bg-white/80 hover:text-ink'
                }`}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="bg-[color:var(--accent)] text-[#1a1b1f] px-4 py-2 rounded-full hover:bg-[color:var(--accent-strong)] transition-colors font-semibold shadow-soft"
              >
                Get Started
              </Link>
            </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className={`md:hidden rounded-full border p-2.5 transition-all ${
              isDark
                ? 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]'
                : 'border-white/80 bg-white/85 text-ink-muted hover:bg-[color:var(--surface-muted)]'
            }`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className={`md:hidden py-4 ${isDark ? 'border-t border-white/10' : 'border-t border-line'}`}>
            <div
              className={`rounded-[1.75rem] border p-3 shadow-[0_22px_50px_rgba(2,8,23,0.24)] ${
                isDark ? 'border-white/10 bg-white/[0.04]' : 'border-white/80 bg-white/92'
              }`}
            >
              <div className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => { handleNavClick(e, item.anchor); setIsMenuOpen(false); }}
                    className={getNavLinkClasses(item.href, true)}
                    aria-current={isNavItemActive(item.href) ? 'page' : undefined}
                  >
                    <span>{item.label}</span>
                    <span className={`text-xs font-semibold uppercase tracking-[0.24em] ${isNavItemActive(item.href) ? (isDark ? 'text-sky-200/80' : 'text-sky-600/80') : (isDark ? 'text-white/30' : 'text-ink-muted/50')}`}>
                      {String(navItems.findIndex((nav) => nav.href === item.href) + 1).padStart(2, '0')}
                    </span>
                  </Link>
                ))}

                {/* Mobile Auth Section */}
                <div className={`mt-4 pt-4 ${isDark ? 'border-t border-white/10' : 'border-t border-line'}`}>
                  {isAuthenticated && user ? (
                    <div className="space-y-4">
                      {/* User Info */}
                      <div className="flex min-w-0 items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center text-white font-semibold shadow-soft overflow-hidden">
                          {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarUrl} alt={user.full_name} className="h-full w-full object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={defaultAvatarUrl}
                              alt={user.full_name ? `${user.full_name} profile` : 'Student profile'}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${isDark ? 'text-white' : 'text-ink'}`}>
                            {user.full_name}
                          </p>
                          <p className={`truncate text-xs ${isDark ? 'text-white/60' : 'text-ink-muted'}`}>
                            {displayIdLabel}: {displayId}
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/profile"
                        className={`block transition-colors ${
                          isDark ? 'text-white/70 hover:text-white' : 'text-ink-muted hover:text-[color:var(--accent-cool)]'
                        }`}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Profile
                      </Link>
                      <Link
                        href="/notifications"
                        className={`block transition-colors ${
                          isDark ? 'text-white/70 hover:text-white' : 'text-ink-muted hover:text-[color:var(--accent-cool)]'
                        }`}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Notifications {unreadCount > 0 ? `(${unreadCount > 9 ? '9+' : unreadCount})` : ''}
                      </Link>
                      {showLibrarianDesk && (
                        <Link
                          href="/librarian"
                          className={`block transition-colors ${
                            isDark ? 'text-white/70 hover:text-white' : 'text-ink-muted hover:text-[color:var(--accent-cool)]'
                          }`}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          Librarian Desk
                        </Link>
                      )}
                      {showStaffDesk && (
                        <Link
                          href="/staff"
                          className={`block transition-colors ${
                            isDark ? 'text-white/70 hover:text-white' : 'text-ink-muted hover:text-[color:var(--accent-cool)]'
                          }`}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {staffDeskLabel}
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="w-full text-left text-rose-600 hover:text-rose-700 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Link
                        href="/login"
                        className={`rounded-full px-4 py-3 text-center text-sm font-medium transition-all ${
                          isDark
                            ? 'border border-white/10 text-white/80 hover:bg-white/[0.06] hover:text-sky-200'
                            : 'border border-line text-ink-muted hover:bg-[color:var(--surface-muted)] hover:text-ink'
                        }`}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/register"
                        className="bg-[color:var(--accent)] text-[#1a1b1f] px-4 py-3 rounded-full hover:bg-[color:var(--accent-strong)] transition-colors font-semibold text-center shadow-soft"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Get Started
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
