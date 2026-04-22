const PENDING_COUNTS_EVENT = 'desk:pending-counts-updated';

export type PendingCounts = {
  pendingAccounts: number;
  borrowRequests: number;
  returnRequests: number;
  renewalRequests: number;
  overdueBooks: number;
};

export function emitPendingCountsUpdated(counts: PendingCounts) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PendingCounts>(PENDING_COUNTS_EVENT, { detail: counts }));
}

export function subscribeToPendingCounts(listener: (counts: PendingCounts) => void) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => listener((e as CustomEvent<PendingCounts>).detail);
  window.addEventListener(PENDING_COUNTS_EVENT, handler);
  return () => window.removeEventListener(PENDING_COUNTS_EVENT, handler);
}
