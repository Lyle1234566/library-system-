const UNREAD_COUNT_UPDATED_EVENT = 'notifications:unread-count-updated';

export function emitUnreadCountUpdated(unreadCount: number) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<number>(UNREAD_COUNT_UPDATED_EVENT, {
      detail: unreadCount,
    })
  );
}

export function subscribeToUnreadCountUpdated(listener: (unreadCount: number) => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleEvent = (event: Event) => {
    const customEvent = event as CustomEvent<number>;
    listener(typeof customEvent.detail === 'number' ? customEvent.detail : 0);
  };

  window.addEventListener(UNREAD_COUNT_UPDATED_EVENT, handleEvent);
  return () => window.removeEventListener(UNREAD_COUNT_UPDATED_EVENT, handleEvent);
}
