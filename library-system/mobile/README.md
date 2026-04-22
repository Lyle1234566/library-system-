# SCSIT Library System (React Native)

This app uses the **same Django backend** as your existing web app:

- Auth: `/api/auth/*`
- Books: `/api/books/*`
- Database: unchanged (no new database, no new schema)

## 1) Install and run

```bash
cd mobile
npm install
npm start
```

Then open on Android/iOS simulator or Expo Go.

## 2) Configure backend URL

Create `mobile/.env` from `.env.example`.

For real devices on Wi-Fi, use your computer LAN IP:

```env
EXPO_PUBLIC_API_URL=http://192.168.x.x:8000/api
```

For Android emulator, `http://10.0.2.2:8000/api` works.

If `EXPO_PUBLIC_API_URL` is not set, the app now tries to auto-detect your dev machine host from Metro and falls back to emulator/simulator localhost defaults.

Do not use `http://localhost:8000/api` on a physical device. `localhost` on the phone/emulator is not your computer.

## 3) Run backend (same one used by web)

From `backend/`:

```bash
python manage.py runserver 0.0.0.0:8000
```

Quick connectivity checks:

```bash
http://127.0.0.1:8000/api/health/
http://YOUR_LAN_IP:8000/api/health/
```

Expected JSON:

```json
{"status":"ok","service":"salazar-library-api"}
```

The mobile app and web app will both read/write the same backend and same DB records.

## Included mobile features

- Sign in (student/librarian/staff portal)
- Student account registration
- Dashboard
- Catalog search/list
- Book details
- Borrow request
- Return request
- My Books status tracking
- Profile and logout
