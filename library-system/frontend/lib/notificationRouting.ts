type NotificationRouteRecord = {
  notification_type: string;
  data?: Record<string, unknown> | null;
};

function getStringNotificationValue(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
}

function getNumericNotificationValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
  }

  return null;
}

export function getNotificationCategory(notification: NotificationRouteRecord) {
  const dashboardSection = getStringNotificationValue(notification.data?.dashboard_section);
  if (notification.notification_type.startsWith('RESERVATION')) {
    return 'reservation';
  }
  if (dashboardSection === 'desk-accounts' || notification.notification_type.startsWith('ACCOUNT')) {
    return 'account';
  }
  if (
    notification.notification_type.startsWith('BORROW') ||
    notification.notification_type.startsWith('RETURN') ||
    notification.notification_type.startsWith('RENEWAL') ||
    notification.notification_type.startsWith('REPORT') ||
    dashboardSection === 'desk-borrows' ||
    dashboardSection === 'desk-renewals' ||
    dashboardSection === 'desk-returns'
  ) {
    return 'circulation';
  }
  if (
    notification.notification_type.startsWith('FINE') ||
    notification.notification_type === 'DUE_SOON' ||
    notification.notification_type.startsWith('OVERDUE') ||
    dashboardSection === 'desk-overdue'
  ) {
    return 'reminder';
  }
  return 'account';
}

export function getNotificationHref(notification: NotificationRouteRecord) {
  const bookId = getNumericNotificationValue(notification.data?.book_id);
  const portal = getStringNotificationValue(notification.data?.portal);
  const dashboardSection = getStringNotificationValue(notification.data?.dashboard_section);
  const category = getNotificationCategory(notification);

  if (portal === 'librarian' && dashboardSection) {
    return `/librarian?section=${encodeURIComponent(dashboardSection)}`;
  }
  if (portal === 'staff' && dashboardSection) {
    return `/staff?section=${encodeURIComponent(dashboardSection)}`;
  }
  if (portal === 'staff') {
    return '/staff';
  }
  if (category === 'reservation') {
    return bookId ? `/books/${bookId}` : '/reservations';
  }
  if (category === 'circulation' || category === 'reminder') {
    return bookId ? `/books/${bookId}` : '/my-books';
  }
  return '/settings';
}

export function getNotificationActionLabel(notification: NotificationRouteRecord) {
  const href = getNotificationHref(notification);
  const dashboardSection = getStringNotificationValue(notification.data?.dashboard_section);

  if (dashboardSection === 'desk-accounts') {
    return 'Open pending accounts';
  }
  if (dashboardSection === 'desk-borrows') {
    return 'Open borrow requests';
  }
  if (dashboardSection === 'desk-renewals') {
    return 'Open renewal requests';
  }
  if (dashboardSection === 'desk-returns') {
    return 'Open return requests';
  }
  if (dashboardSection === 'desk-overdue') {
    return 'Open overdue books';
  }
  if (dashboardSection === 'desk-contact') {
    return 'Open contact messages';
  }

  if (href.startsWith('/books/')) {
    return 'Open book details';
  }
  if (href.startsWith('/librarian')) {
    return 'Open librarian desk';
  }
  if (href.startsWith('/staff')) {
    return 'Open staff desk';
  }
  if (href === '/reservations') {
    return 'Open reservations';
  }
  if (href === '/my-books') {
    return 'Open my books';
  }
  if (notification.notification_type === 'CONTACT_REPLY') {
    return 'View notification';
  }
  if (href === '/settings') {
    return 'Open settings';
  }
  return 'Open related page';
}
