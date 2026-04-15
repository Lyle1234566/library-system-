# 🔧 LOGIN ISSUE - COMPLETE FIX

## ❌ Problem
Users getting **401 Unauthorized** when trying to log in.

## ✅ Solution

### STEP 1: Check if users exist

```bash
cd backend
python manage.py list_users
```

If no users exist, go to **STEP 2**.
If users exist but can't login, go to **STEP 3**.

---

### STEP 2: Create Test Accounts

Run this command to create test accounts:

```bash
python manage.py shell
```

Then paste this code:

```python
from django.contrib.auth import get_user_model
User = get_user_model()

# Create Admin/Superuser
admin = User.objects.create_superuser(
    username='admin',
    password='admin123',
    email='admin@library.com',
    full_name='System Administrator'
)
admin.role = 'ADMIN'
admin.save()
print(f"✅ Created admin: admin / admin123")

# Create Librarian
librarian = User.objects.create_user(
    username='LIB001',
    staff_id='LIB001',
    password='librarian123',
    full_name='Test Librarian',
    email='librarian@library.com',
    role='LIBRARIAN',
    is_active=True
)
print(f"✅ Created librarian: LIB001 / librarian123")

# Create Student
student = User.objects.create_user(
    username='STU001',
    student_id='STU001',
    password='student123',
    full_name='Test Student',
    email='student@library.com',
    role='STUDENT',
    is_active=True
)
print(f"✅ Created student: STU001 / student123")

print("\n✅ All test accounts created successfully!")
exit()
```

---

### STEP 3: Activate Existing Users

If users exist but are **INACTIVE**, activate them:

```bash
# Check user status
python manage.py check_user STU001

# Activate user
python manage.py check_user STU001 --activate

# Set new password
python manage.py check_user STU001 --set-password student123
```

---

### STEP 4: Test Login

**Option A: Test via Frontend**
1. Go to http://localhost:3000/login
2. Use these credentials:
   - **Admin**: `admin` / `admin123`
   - **Librarian**: `LIB001` / `librarian123`
   - **Student**: `STU001` / `student123`

**Option B: Test via API**
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d "{\"student_id\":\"STU001\",\"password\":\"student123\"}"
```

---

## 🎯 Quick Commands

```bash
# List all users
python manage.py list_users

# Check specific user
python manage.py check_user STU001

# Activate user
python manage.py check_user STU001 --activate

# Reset password
python manage.py check_user STU001 --set-password newpassword

# Create superuser
python manage.py createsuperuser
```

---

## 📝 Test Accounts Created

| Role | Login ID | Password | Portal |
|------|----------|----------|--------|
| Admin | `admin` | `admin123` | Admin Panel |
| Librarian | `LIB001` | `librarian123` | Librarian Portal |
| Student | `STU001` | `student123` | Student Portal |

---

## 🔍 Common Issues

### Issue 1: "Invalid ID or password"
**Cause**: User doesn't exist or wrong password
**Fix**: 
```bash
python manage.py check_user <id>
python manage.py check_user <id> --set-password newpass
```

### Issue 2: "Account pending approval"
**Cause**: User account is not active (is_active=False)
**Fix**:
```bash
python manage.py check_user <id> --activate
```

### Issue 3: "Cannot access portal"
**Cause**: User role doesn't match portal
**Fix**: Check user role matches portal:
- Student portal → STUDENT, WORKING
- Librarian portal → LIBRARIAN, ADMIN
- Staff portal → STAFF, WORKING, ADMIN

---

## ✅ Verification Checklist

- [ ] Backend server is running (`python manage.py runserver`)
- [ ] Frontend server is running (`npm run dev`)
- [ ] Users exist in database (`python manage.py list_users`)
- [ ] User accounts are active (`is_active=True`)
- [ ] Passwords are set correctly
- [ ] User roles match the portal they're trying to access

---

## 🚀 After Fix

Once login works:
1. ✅ Students can browse books and request borrows
2. ✅ Librarians can approve requests and manage catalog
3. ✅ Admins can access Django admin panel at `/admin`

---

## 💡 Need More Help?

Run these diagnostic commands:

```bash
# Check Django is working
python manage.py check

# Check database migrations
python manage.py showmigrations

# Run migrations if needed
python manage.py migrate

# Create superuser if needed
python manage.py createsuperuser
```
