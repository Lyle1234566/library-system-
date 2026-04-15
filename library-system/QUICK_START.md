# Quick Start

Use this setup for local development as of March 29, 2026.

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL

## 1. Backend

From `backend/`:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env` from `backend/.env.example` and set at least:

- `SECRET_KEY`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `MEDIA_ROOT`
- email settings if you want live email delivery

Run the API:

```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Backend URLs:

- API base: `http://localhost:8000/api`
- Admin: `http://localhost:8000/admin`

## 2. Web App

From `frontend/`:

```bash
npm install
```

Create `frontend/.env.local` from `frontend/.env.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
# Optional when media is served from a different host:
# NEXT_PUBLIC_MEDIA_HOSTS=http://localhost:8000
```

Run the web app:

```bash
npm run dev
```

Web URL:

- `http://localhost:3000`

## 3. Mobile App

From `mobile/`:

```bash
npm install
```

Create `mobile/.env` from `mobile/.env.example` and point `EXPO_PUBLIC_API_URL` to the Django API.

Run the Expo app:

```bash
npm start
```

## 4. Recommended Verification

Backend:

```bash
python manage.py test user
python manage.py test books
python manage.py check
```

Web:

```bash
npm run lint
npm run build
```

Mobile:

```bash
npm run typecheck
```
