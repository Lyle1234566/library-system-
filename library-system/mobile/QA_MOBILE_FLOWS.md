# Mobile QA Flow Checklist

Date: 2026-03-05

## Scope

This checklist validates mobile parity for:
- renew flows
- reading history
- reservations
- fines and borrow blocking
- advanced filters
- in-app notifications

## Pre-check

1. Run `npm run typecheck` in `mobile`.
2. Run `python manage.py test books user` in `backend`.
3. Ensure backend migrations are applied.

## Auth and Session

1. Login with a student account.
2. Kill and reopen app.
3. Confirm session persists and profile loads.
4. Logout and confirm protected tabs/screens are inaccessible.

## Borrow and Renew

1. Borrow an available book from Books or Book Details.
2. Open My Books and verify request appears.
3. Tap Renew on an eligible approved request.
4. Confirm due date extends and renewal count increments.
5. Verify renew button disappears when max renewals reached.

## Reading History

1. Return a borrowed book and have staff approve return.
2. Open Reading History.
3. Confirm returned record appears with borrow/return date and late fee if any.
4. Tap history item and confirm Book Details opens.

## Reservations

1. Open a fully unavailable book and submit reservation.
2. Open My Reservations and verify:
   - status
   - queue position/current position
3. Cancel reservation and verify status changes to Cancelled.
4. If return is approved for reserved title, confirm status changes to Notified and expiry is shown.

## Fines and Borrow Blocking

1. Create overdue fine (return overdue book).
2. Open Profile and verify:
   - unpaid total
   - pending fine count
   - block threshold
3. If unpaid exceeds threshold, attempt borrow and confirm block message appears.
4. Mark fine paid/waived from staff and confirm Profile updates after refresh.

## Advanced Filters

1. Open Books and expand Advanced Filters.
2. Apply each filter independently:
   - availability
   - category
   - author
   - grade level
   - language
3. Apply multiple filters together and verify result list changes.
4. Reset filters and verify full list returns.

## Notifications

1. Trigger borrow approval/rejection and return approval/rejection.
2. Open Notifications and confirm new entries appear.
3. Tap unread item to mark read.
4. Use Mark all read and verify unread count becomes zero.
5. Keep app open and trigger a new notification; verify in-app alert appears on next poll cycle.

## Regression checks

1. Dashboard cards still navigate correctly.
2. Book Details borrow/return/reserve actions still work.
3. My Books due alerts still render.
4. Profile logout still works.
