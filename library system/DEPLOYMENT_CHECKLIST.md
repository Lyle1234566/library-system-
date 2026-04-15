# ⚡ Quick Deployment Checklist

Use this as a quick reference while deploying.

---

## 🔴 BEFORE YOU START

### 1. Push Code to GitHub
```bash
cd "c:\Users\lylep\Desktop\library system"
git add .
git commit -m "Prepare for deployment"
git push origin main
```
If the project root is not already a Git repository, initialize it first or create separate backend/frontend repositories before using the GitHub deployment flow.

### 2. Generate Secret Key
```bash
cd backend
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```
**Copy the output** - you'll need it for Railway.

---

## 🚂 RAILWAY BACKEND (15 min)

### Setup
- [ ] Create account at https://railway.app
- [ ] New Project → Deploy from GitHub
- [ ] Select your repository
- [ ] Add PostgreSQL database (New → Database → PostgreSQL)
- [ ] Add a persistent volume and mount it to `/data`

### Environment Variables
Go to backend service → Variables → Add all:

```
SECRET_KEY=<paste-generated-key-here>
DEBUG=False
DJANGO_ALLOWED_HOSTS=${{RAILWAY_PUBLIC_DOMAIN}}
CSRF_TRUSTED_ORIGINS=https://${{RAILWAY_PUBLIC_DOMAIN}},https://your-project.vercel.app
USE_X_FORWARDED_PROTO=true
SERVE_MEDIA_FILES=true
MEDIA_ROOT=/data/media
STATIC_ROOT=/app/staticfiles
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_CONN_MAX_AGE=60
DB_CONN_HEALTH_CHECKS=true
CORS_ALLOWED_ORIGINS=https://your-project.vercel.app
LIBRARY_WEB_URL=https://your-project.vercel.app
PASSWORD_RESET_WEB_URL=https://your-project.vercel.app/forgot-password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
LATE_FEE_PER_DAY=100.00
```

### Settings
- [ ] Settings → Root Directory → `backend`
- [ ] Settings → Networking → Generate Domain
- [ ] Volume mount path is exactly `/data`
- [ ] **Copy the domain URL** (e.g., `https://abc123.railway.app`)

### Database Setup
- [ ] Wait for deployment to complete
- [ ] Migrations run automatically (check logs)
- [ ] Create superuser via Railway console:
  ```bash
  python manage.py createsuperuser
  ```

### Test
- [ ] Visit `https://your-backend.railway.app/admin`
- [ ] Should see Django admin login page ✅
- [ ] Visit `https://your-backend.railway.app/api/health/`
- [ ] `services.database` and `services.media_storage` should both be `ok` ✅

---

## ▲ VERCEL FRONTEND (10 min)

### Setup
- [ ] Create account at https://vercel.com
- [ ] Add New → Project
- [ ] Import your GitHub repository
- [ ] Root Directory → `library system/frontend`

### Environment Variables
Add in Vercel:

```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
```

**Replace** `your-backend.railway.app` with your Railway URL.

Optional for external media/CDN hosts:
```
NEXT_PUBLIC_MEDIA_HOSTS=https://media.your-domain.com
```

### Deploy
- [ ] Click Deploy
- [ ] Wait 2-3 minutes
- [ ] **Copy Vercel URL** (e.g., `https://your-project.vercel.app`)

### Update CORS
Go back to Railway → Backend → Variables:
- [ ] Update `CORS_ALLOWED_ORIGINS`:
  ```
  CORS_ALLOWED_ORIGINS=https://your-project.vercel.app
  ```
- [ ] Update `CSRF_TRUSTED_ORIGINS`:
  ```
  CSRF_TRUSTED_ORIGINS=https://your-backend.railway.app,https://your-project.vercel.app
  ```
- [ ] Update `LIBRARY_WEB_URL` and `PASSWORD_RESET_WEB_URL`:
  ```
  LIBRARY_WEB_URL=https://your-project.vercel.app
  PASSWORD_RESET_WEB_URL=https://your-project.vercel.app/forgot-password
  ```
- [ ] Save (auto-redeploys)

### Test
- [ ] Visit `https://your-project.vercel.app`
- [ ] Should see library homepage ✅
- [ ] Try logging in with superuser ✅

---

## ✅ POST-DEPLOYMENT

### Add Initial Data
- [ ] Go to `https://your-backend.railway.app/admin`
- [ ] Add categories (Fiction, Non-Fiction, etc.)
- [ ] Add 5-10 books with covers
- [ ] Create test users (student, librarian)

### Test Complete Flow
- [ ] Register as student
- [ ] Approve student (as admin)
- [ ] Browse books
- [ ] Request borrow
- [ ] Approve borrow (as admin)
- [ ] Request return
- [ ] Approve return (as admin)
- [ ] Upload a book cover and confirm it still loads after a redeploy
- [ ] Trigger password reset and confirm the email link opens the deployed frontend

---

## 🐛 COMMON ISSUES

### "Application Error" on Railway
```bash
# Check logs in Railway → Deployments → View Logs
# Usually missing migrations:
python manage.py migrate
```

### CORS Error
- Check `CORS_ALLOWED_ORIGINS` includes your Vercel URL
- Must be `https://` (not `http://`)
- No trailing slash
- Redeploy backend after change

### Images Not Loading
- Check `NEXT_PUBLIC_API_URL` and optional `NEXT_PUBLIC_MEDIA_HOSTS`
- Redeploy frontend

### Uploaded Images Disappear After Redeploy
- Check Railway volume is mounted to `/data`
- Confirm `MEDIA_ROOT=/data/media`
- Re-upload one test image and redeploy backend to verify persistence

### Can't Login
- Check `NEXT_PUBLIC_API_URL` in Vercel
- Must end with `/api` (no trailing slash)
- Check Railway backend is running

---

## 📝 URLS TO SAVE

After deployment, save these:

```
Frontend: https://your-project.vercel.app
Backend: https://your-backend.railway.app
Admin: https://your-backend.railway.app/admin
API: https://your-backend.railway.app/api
```

---

## 🎓 FOR PRESENTATION

### Demo Accounts
Create these in admin panel:
- Admin: admin / admin123
- Librarian: librarian@test.com / test123
- Student: student@test.com / test123

### Features to Show
1. ✅ Student registration & approval
2. ✅ Book catalog with search
3. ✅ Borrow workflow
4. ✅ Return workflow
5. ✅ Late fees
6. ✅ Analytics dashboard
7. ✅ Admin panel

---

## ⏱️ ESTIMATED TIME

- Railway Backend: 15 minutes
- Vercel Frontend: 10 minutes
- Testing & Data: 15 minutes
- **Total: 40 minutes**

---

**Ready? Start with Railway Backend! 🚀**
