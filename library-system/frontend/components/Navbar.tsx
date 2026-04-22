'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsApi, resolveMediaUrl } from '@/lib/api';
import { subscribeToUnreadCountUpdated } from '@/lib/notificationEvents';
import { subscribeToPendingCounts, type PendingCounts } from '@/lib/pendingCounts';
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
  const [pendingCounts, setPendingCounts] = useState<PendingCounts | null>(null);
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
      ? 'group relative flex items-center justify-between overflow-hidden rounded-2xl px-4 py-3.5 text-sm font-semibold tracking-[0.02em] transition-all duration-300'
      : 'group relative inline-flex items-center overflow-hidden rounded-full px-5 py-2.5 text-[0.95rem] font-semibold tracking-[0.015em] transition-all duration-300';

    if (isDark) {
      return `${baseClasses} ${
        isActive
          ? mobile
            ? 'bg-[linear-gradient(135deg,rgba(14,165,233,0.20)_0%,rgba(34,211,238,0.10)_50%,rgba(15,23,42,0.18)_100%)] text-white shadow-[0_16px_36px_rgba(8,145,178,0.22)]'
            : 'bg-[linear-gradient(135deg,rgba(14,165,233,0.18)_0%,rgba(34,211,238,0.08)_48%,rgba(15,23,42,0.10)_100%)] text-white shadow-[0_14px_30px_rgba(8,145,178,0.18)]'
          : mobile
            ? 'text-white/72 hover:bg-white/[0.035] hover:text-white'
            : 'text-white/68 hover:bg-white/[0.03] hover:text-white hover:-translate-y-0.5'
      }`;
    }

    return `${baseClasses} ${
      isActive
        ? 'bg-[linear-gradient(135deg,rgba(14,165,233,0.12)_0%,rgba(255,255,255,0.9)_100%)] text-[color:var(--accent-cool-strong)] shadow-[0_12px_28px_rgba(14,165,233,0.14)]'
        : 'text-ink-muted hover:bg-white/75 hover:text-[color:var(--accent-cool-strong)] hover:-translate-y-0.5'
    }`;
  };

  const getNavIndicatorClasses = (href: string) => {
    const isActive = isNavItemActive(href);
    return isDark
      ? isActive
        ? 'opacity-100 scale-100 bg-gradient-to-r from-sky-400/0 via-cyan-200 to-sky-400/0 shadow-[0_0_18px_rgba(103,232,249,0.55)]'
        : 'opacity-0 scale-75 bg-gradient-to-r from-sky-400/0 via-cyan-200/80 to-sky-400/0 group-hover:opacity-100 group-hover:scale-100'
      : isActive
        ? 'opacity-100 scale-100 bg-gradient-to-r from-sky-500/0 via-sky-500 to-sky-500/0 shadow-[0_0_14px_rgba(14,165,233,0.26)]'
        : 'opacity-0 scale-75 bg-gradient-to-r from-sky-500/0 via-sky-500/70 to-sky-500/0 group-hover:opacity-100 group-hover:scale-100';
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

  useEffect(() => {
    return subscribeToPendingCounts((counts) => {
      setPendingCounts(counts);
    });
  }, []);

  const handleLogout = () => {
    logout();
    setUnreadCount(0);
    setPendingCounts(null);
    setIsProfileOpen(false);
    setIsMenuOpen(false);
  };

  const isStaffOrLibrarian = user && ['LIBRARIAN', 'ADMIN', 'STAFF', 'WORKING'].includes(user.role);
  const pendingWorkCount = isStaffOrLibrarian && pendingCounts
    ? (pendingCounts.pendingAccounts +
       pendingCounts.borrowRequests +
       pendingCounts.returnRequests +
       pendingCounts.renewalRequests +
       pendingCounts.overdueBooks)
    : 0;

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
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl shadow-[var(--nav-shadow)] ${
        isDark
          ? 'bg-[linear-gradient(180deg,rgba(7,24,37,0.62)_0%,rgba(10,32,49,0.58)_52%,rgba(8,28,44,0.52)_100%)] shadow-[0_18px_52px_rgba(2,8,23,0.24)]'
          : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,249,255,0.90)_100%)]'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className={`absolute left-[12%] top-[-8rem] h-56 w-56 rounded-full blur-3xl ${
            isDark ? 'bg-sky-300/14' : 'bg-sky-400/10'
          }`}
        />
        <div
          className={`absolute right-[10%] top-[-9rem] h-64 w-64 rounded-full blur-3xl ${
            isDark ? 'bg-cyan-200/12' : 'bg-cyan-300/8'
          }`}
        />
        <div
          className={`absolute left-1/2 top-full h-16 w-[32rem] -translate-x-1/2 -translate-y-8 blur-3xl ${
            isDark ? 'bg-sky-200/12' : 'bg-sky-400/8'
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
                alt="SCSIT Library System logo"
                fill
                sizes="(min-width: 640px) 56px, 48px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 leading-tight">
              <span className={`block truncate text-[0.98rem] font-semibold tracking-tight sm:text-[1.08rem] ${isDark ? 'text-white' : 'text-ink'}`}>
                SCSIT Library System
              </span>
              <span className={`hidden sm:block truncate text-[0.52rem] font-medium uppercase tracking-[0.16em] ${isDark ? 'text-white/42' : 'text-ink-muted/75'}`}>
                Salazar Colleges of Science and Institute of Technology
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div
            className={`hidden md:flex items-center gap-1.5 rounded-full px-1 py-1 ${
              isDark
                ? 'bg-transparent'
                : 'bg-transparent'
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
                <span className={`pointer-events-none absolute inset-x-5 bottom-1 h-[2px] rounded-full transition-all duration-300 ${getNavIndicatorClasses(item.href)}`} />
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
                  className={`relative flex items-center space-x-2 rounded-full px-2.5 py-1.5 transition-all focus:outline-none ${
                    isDark
                      ? 'bg-white/[0.05] shadow-[0_12px_24px_rgba(2,8,23,0.20)] hover:bg-white/[0.08]'
                      : 'bg-white/90 shadow-[0_12px_24px_rgba(15,23,42,0.08)] hover:bg-white'
                  }`}
                >
                  {(unreadCount > 0 || pendingWorkCount > 0) && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-sky-200 px-1.5 text-[10px] font-bold text-[#08213a] shadow-[0_10px_24px_rgba(142,219,255,0.35)]">
                      {(unreadCount + pendingWorkCount) > 9 ? '9+' : (unreadCount + pendingWorkCount)}
                    </span>
                  )}
                  <div className="w-8 h-8 rounded-full bg-[#8edbff] flex items-center justify-center text-[#08213a] font-semibold overflow-hidden" style={{ boxShadow: '0 0 0 2px rgba(142,219,255,0.7), 0 0 10px rgba(142,219,255,0.3)' }}>
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
                          <span className="ml-auto rounded-full bg-sky-200 px-2 py-0.5 text-[10px] font-bold text-[#08213a]">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </Link>
                      {isStaffOrLibrarian && pendingWorkCount > 0 && (
                        <div className={`${dropdownItemClasses} pointer-events-none`}>
                          <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span className="text-xs text-sky-300 font-semibold">Pending work</span>
                          <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            {pendingWorkCount > 9 ? '9+' : pendingWorkCount}
                          </span>
                        </div>
                      )}
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
            className={`md:hidden rounded-full p-2.5 transition-all ${
              isDark
                ? 'bg-white/[0.05] text-white/78 shadow-[0_10px_24px_rgba(2,8,23,0.20)] hover:bg-white/[0.09]'
                : 'bg-white/90 text-ink-muted shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:bg-[color:var(--surface-muted)]'
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
          <div className="md:hidden py-4">
            <div
              className={`rounded-[1.75rem] p-3 shadow-[0_22px_50px_rgba(2,8,23,0.24)] ${
                isDark ? 'bg-[linear-gradient(180deg,rgba(14,22,44,0.82)_0%,rgba(10,19,38,0.92)_100%)]' : 'bg-white/94'
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
                <div className={`mt-4 pt-4 ${isDark ? 'border-t border-white/8' : 'border-t border-line/80'}`}>
                  {isAuthenticated && user ? (
                    <div className="space-y-4">
                      {/* User Info */}
                      <div className="flex min-w-0 items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-[#8edbff] flex items-center justify-center text-[#08213a] font-semibold shadow-soft overflow-hidden">
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
                            ? 'bg-white/[0.05] text-white/84 hover:bg-white/[0.08] hover:text-sky-100'
                            : 'bg-white text-ink-muted shadow-[0_10px_24px_rgba(15,23,42,0.05)] hover:bg-[color:var(--surface-muted)] hover:text-ink'
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
