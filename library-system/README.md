# SCSIT Library System

School library system built with Django, Next.js, and React Native/Expo.

## Status Snapshot

As of April 14, 2026:

- Overall project: about 90% to 92% complete
- Backend/API: about 95% complete
- Web app: about 92% to 95% complete
- Mobile app: about 80% to 85% complete
- Deployment readiness: about 85% to 90% complete

## What Is Working

- JWT authentication, OTP/email recovery, role-based access, and profile management
- Book catalog, categories, cover uploads, copy tracking, and inventory controls
- Borrow, return, renewal, reservation, overdue, and fine payment workflows
- Teacher reporting flow and circulation staff tooling
- In-app notifications plus due-soon and account email flows
- Reviews and ratings
- Report export and librarian analytics
- Recommendations:
  - similar-book recommendations on the web book detail page
  - personalized recommendations on the web dashboard
  - matching backend API endpoints
- Mobile core flows:
  - catalog
  - book details
  - my books
  - reservations
  - notifications
  - staff/operations desk

## Verified Locally

These checks passed in this workspace on April 14, 2026:

- Backend tests: `86/86` passed
- Django deploy check: passed with production environment variables supplied
- Web app lint: passed
- Web production build: passed
- Mobile typecheck: passed

## Remaining Work

- Final live deployment rollout and smoke testing on the target host
- Persistent media volume setup verification on the production backend
- Production email/domain verification
- Barcode/QR code presentation and scanning workflow
- Recommendation surfaces in the mobile app
- Formal API documentation/OpenAPI
- Final release checklist and hosting automation

## Stack

- Backend: Django 5, Django REST Framework, Simple JWT
- Database: PostgreSQL
- Web: Next.js App Router
- Mobile: React Native with Expo

## Local Setup

Use the project guides below:

- [QUICK_START.md](./QUICK_START.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [TODO.md](./TODO.md)

Minimal local run sequence:

1. Start PostgreSQL and create the database.
2. Configure [backend/.env.example](./backend/.env.example) as `backend/.env`.
3. Run the Django API from `backend/`.
4. Configure `frontend/.env.local` from [frontend/.env.example](./frontend/.env.example).
5. Run the Next.js app from `frontend/`.
6. Optionally configure `mobile/.env.example` and run the Expo app from `mobile/`.

## Repository Layout

- `backend/`: Django API and admin
- `frontend/`: Next.js web client
- `mobile/`: React Native/Expo mobile client
- `DEPLOYMENT_CHECKLIST.md`: production deployment checklist
- `IMPLEMENTATION_STATUS.md`: current feature state
- `TODO.md`: remaining work
