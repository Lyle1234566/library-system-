# 🚀 Vercel + Railway Deployment Guide

Complete step-by-step guide to deploy your Salazar Library System.

---

## 📋 Overview

- **Frontend**: Vercel (Free tier)
- **Backend**: Railway (Free tier with $5 credit)
- **Database**: PostgreSQL on Railway (Free tier)
- **Total Cost**: FREE for development/capstone demo

---

## 🎯 Part 1: Deploy Backend on Railway (15 minutes)

### Step 1: Create Railway Account

1. Go to https://railway.app
2. Click "Login" → Sign up with GitHub
3. Verify your email
4. You get $5 free credit (no credit card required)

### Step 2: Create New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub account
4. Select your library system repository
5. Railway will detect your project

### Step 3: Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "Add PostgreSQL"
3. Railway automatically creates the database
4. Note: Database credentials are auto-generated

### Step 4: Add Persistent Media Storage

1. In your Railway project, click "New"
2. Select "Volume"
3. Mount the volume to `/data`
4. This keeps uploaded book covers and avatars after redeploys

### Step 5: Configure Backend Service

1. Click on your backend service (should auto-detect Django)
2. Go to "Settings" tab
3. Set "Root Directory" to `backend`
4. Go to "Variables" tab
5. Add these environment variables:

```env
SECRET_KEY=django-insecure-xf1nsfih1-bbqk19@+3l+97bsh7g!6+@yzij@_r0qq3apnjb06-CHANGE-THIS
DEBUG=False
DJANGO_ALLOWED_HOSTS=${{RAILWAY_PUBLIC_DOMAIN}}
CSRF_TRUSTED_ORIGINS=https://${{RAILWAY_PUBLIC_DOMAIN}},https://your-frontend.vercel.app
USE_X_FORWARDED_PROTO=true
SERVE_MEDIA_FILES=true
MEDIA_ROOT=/data/media
STATIC_ROOT=/app/staticfiles

# Database (Railway auto-provides these - just reference them)
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_CONN_MAX_AGE=60
DB_CONN_HEALTH_CHECKS=true

# CORS (Update after deploying frontend)
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
LIBRARY_WEB_URL=https://your-frontend.vercel.app
PASSWORD_RESET_WEB_URL=https://your-frontend.vercel.app/forgot-password

# Email (Optional - for password reset)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=true
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=Salazar Library System <your-email@gmail.com>

# Library Settings
LATE_FEE_PER_DAY=100.00
```

**IMPORTANT**: To reference the PostgreSQL database:
- Click on the PostgreSQL service
- Copy the variable names (PGDATABASE, PGUSER, etc.)
- Use `${{Postgres.VARIABLE_NAME}}` format in your backend variables

### Step 6: Generate Secret Key

Run this in your local terminal:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Copy the output and replace the SECRET_KEY value in Railway.

### Step 7: Deploy Backend

1. Railway will automatically deploy after you add variables
2. Wait 3-5 minutes for deployment
3. Check "Deployments" tab for progress
4. If deployment fails, check logs

### Step 8: Run Database Migrations

1. Go to your backend service
2. Click "Settings" → "Deploy"
3. The railway.json file will automatically run migrations
4. Or manually run in Railway console:
   ```bash
   python manage.py migrate
   python manage.py collectstatic --noinput
   ```

### Step 9: Create Superuser

1. In Railway, click your backend service
2. Go to "Settings" → "Deploy" → "Custom Start Command"
3. Temporarily change to: `python manage.py createsuperuser --noinput && gunicorn backend.wsgi:application`
4. Or use Railway CLI:
   ```bash
   railway run python manage.py createsuperuser
   ```

### Step 10: Get Backend URL

1. Go to "Settings" → "Networking"
2. Click "Generate Domain"
3. Copy the URL (e.g., `https://your-backend.railway.app`)
4. Save this URL - you'll need it for frontend

### Step 11: Test Backend

Visit: `https://your-backend.railway.app/admin`
- You should see the Django admin login page
- If you see it, backend is working! ✅

Visit: `https://your-backend.railway.app/api/health/`
- `services.database` should be `ok`
- `services.media_storage` should be `ok`

---

## 🎨 Part 2: Deploy Frontend on Vercel (10 minutes)

### Step 1: Create Vercel Account

1. Go to https://vercel.com
2. Click "Sign Up" → Continue with GitHub
3. Authorize Vercel to access your repositories

### Step 2: Import Project

1. Click "Add New..." → "Project"
2. Select your library system repository
3. Vercel will detect Next.js automatically

### Step 3: Configure Project

1. **Framework Preset**: Next.js (auto-detected)
2. **Root Directory**: Click "Edit" → Select `library system/frontend`
3. **Build Command**: `npm run build` (default)
4. **Output Directory**: `.next` (default)
5. **Install Command**: `npm install` (default)

### Step 4: Add Environment Variables

Click "Environment Variables" and add:

```env
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api
# Optional only if media comes from a separate domain or CDN:
# NEXT_PUBLIC_MEDIA_HOSTS=https://media.your-domain.com
```

**Replace** `your-backend.railway.app` with your actual Railway backend URL from Part 1, Step 9.

### Step 5: Deploy

1. Click "Deploy"
2. Wait 2-3 minutes
3. Vercel will build and deploy your frontend
4. You'll get a URL like: `https://your-project.vercel.app`

### Step 6: Update CORS in Railway

1. Go back to Railway
2. Open your backend service
3. Go to "Variables" tab
4. Update `CORS_ALLOWED_ORIGINS`:
   ```env
   CORS_ALLOWED_ORIGINS=https://your-project.vercel.app,https://www.your-custom-domain.com
   ```
5. Save and redeploy

### Step 7: Test Frontend

1. Visit your Vercel URL: `https://your-project.vercel.app`
2. You should see your library homepage
3. Try logging in with your superuser credentials
4. If login works, deployment is successful! ✅

---

## 🔧 Part 3: Post-Deployment Setup

### 1. Add Custom Domain (Optional)

**For Vercel (Frontend)**:
1. Go to Project Settings → Domains
2. Add your domain (e.g., `library.yourdomain.com`)
3. Update DNS records as instructed
4. Vercel auto-provisions SSL certificate

**For Railway (Backend)**:
1. Go to Settings → Networking
2. Add custom domain (e.g., `api.yourdomain.com`)
3. Update DNS records
4. Railway auto-provisions SSL

### 2. Update CORS After Custom Domain

In Railway backend variables:
```env
CORS_ALLOWED_ORIGINS=https://library.yourdomain.com,https://your-project.vercel.app
DJANGO_ALLOWED_HOSTS=api.yourdomain.com,${{RAILWAY_PUBLIC_DOMAIN}}
```

### 3. Add Initial Data

1. Go to: `https://your-backend.railway.app/admin`
2. Login with superuser
3. Add:
   - Categories (Fiction, Non-Fiction, etc.)
   - Books with cover images
   - Test users (students, librarians)

### 4. Test Complete Workflow

1. Register as student
2. Login as admin → Approve student
3. Login as student → Browse books → Request borrow
4. Login as admin → Approve borrow request
5. Test return workflow

---

## 🐛 Troubleshooting

### Issue: "Application Error" on Railway

**Solution**:
1. Check Railway logs: Service → Deployments → View Logs
2. Common issues:
   - Missing environment variables
   - Database connection error
   - Migration not run

**Fix**:
```bash
# In Railway console
python manage.py migrate
python manage.py collectstatic --noinput
```

### Issue: "502 Bad Gateway" on Railway

**Solution**:
1. Check if Gunicorn is installed: `pip freeze | grep gunicorn`
2. Verify Procfile exists in backend folder
3. Check Railway logs for errors

### Issue: CORS Error on Frontend

**Solution**:
1. Verify `CORS_ALLOWED_ORIGINS` in Railway includes your Vercel URL
2. Make sure URL has `https://` (not `http://`)
3. No trailing slash in URL
4. Redeploy backend after changing CORS

### Issue: Images Not Loading

**Solution**:
1. Check `NEXT_PUBLIC_API_URL` is correct
2. If media is on a separate domain, set `NEXT_PUBLIC_MEDIA_HOSTS`
3. Redeploy frontend

### Issue: `404: NOT_FOUND` right after a "successful" Vercel deploy

**Cause**:
Vercel deployed the repository root instead of the Next.js app.

**Solution**:
1. In Vercel Project Settings, set **Root Directory** to `library system/frontend`
2. Redeploy after the GitHub repository is updated

### Issue: Uploaded Images Disappear After Redeploy

**Solution**:
1. Verify Railway volume is mounted to `/data`
2. Verify `MEDIA_ROOT=/data/media`
3. Re-upload one cover image and redeploy once to confirm persistence

### Issue: Database Connection Error

**Solution**:
1. Verify PostgreSQL service is running in Railway
2. Check database variables are correctly referenced:
   ```env
   DB_HOST=${{Postgres.PGHOST}}
   ```
3. Make sure variable names match your PostgreSQL service name

### Issue: Static Files Not Loading (Admin Panel)

**Solution**:
```bash
# In Railway console
python manage.py collectstatic --noinput
```

Or add to railway.json start command (already included).

---

## 📊 Monitoring & Maintenance

### Check Railway Logs
1. Go to your service
2. Click "Deployments"
3. Click latest deployment
4. View logs in real-time

### Check Vercel Logs
1. Go to your project
2. Click "Deployments"
3. Click latest deployment
4. View function logs

### Database Backups (Railway)
1. Go to PostgreSQL service
2. Click "Data" tab
3. Use Railway CLI for backups:
   ```bash
   railway run pg_dump > backup.sql
   ```

---

## 💰 Cost Breakdown

### Free Tier Limits

**Railway**:
- $5 free credit (no credit card)
- ~500 hours/month
- 1GB RAM
- 1GB storage
- Perfect for capstone demo

**Vercel**:
- 100GB bandwidth/month
- Unlimited deployments
- Free SSL
- Free for personal projects

### When You Need to Upgrade

**Railway** ($5/month):
- After free credit runs out
- Need more resources
- Production use

**Vercel** (Free forever for personal):
- Only upgrade if you need team features
- Or exceed bandwidth limits

---

## 🎉 Success Checklist

- [ ] Backend deployed on Railway
- [ ] PostgreSQL database created
- [ ] Backend environment variables set
- [ ] Database migrations run
- [ ] Superuser created
- [ ] Backend URL accessible
- [ ] Frontend deployed on Vercel
- [ ] Frontend environment variable set
- [ ] CORS configured correctly
- [ ] Can access homepage
- [ ] Can login to admin panel
- [ ] Can register as student
- [ ] Can approve student registration
- [ ] Can borrow books
- [ ] Images loading correctly

---

## 📞 Support Resources

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Django Deployment**: https://docs.djangoproject.com/en/5.2/howto/deployment/
- **Next.js Deployment**: https://nextjs.org/docs/deployment

---

## 🚀 Quick Commands Reference

### Railway CLI (Optional)
```bash
# Install
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Run commands
railway run python manage.py migrate
railway run python manage.py createsuperuser

# View logs
railway logs
```

### Vercel CLI (Optional)
```bash
# Install
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# View logs
vercel logs
```

---

## 🎓 For Your Capstone Presentation

### Demo URLs to Share
- **Frontend**: https://your-project.vercel.app
- **Admin Panel**: https://your-backend.railway.app/admin
- **API Docs**: https://your-backend.railway.app/api

### Test Accounts to Prepare
1. **Admin**: admin / your-password
2. **Librarian**: librarian@test.com / test123
3. **Student**: student@test.com / test123

### Features to Demonstrate
1. Student registration and approval
2. Book catalog browsing
3. Borrow request workflow
4. Return request workflow
5. Late fee calculation
6. Analytics dashboard
7. Admin panel management

---

**Good luck with your capstone! 🎓**

If you encounter any issues during deployment, check the troubleshooting section or the Railway/Vercel logs for specific error messages.
