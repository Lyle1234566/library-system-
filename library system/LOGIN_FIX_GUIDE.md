# Login Issue Fix Guide

## Problem
Users getting 401 Unauthorized when trying to log in.

## Common Causes
1. **User doesn't exist** - Account not created yet
2. **Wrong password** - Password doesn't match
3. **Account not active** - User account has `is_active=False`
4. **Wrong credentials** - Using wrong Student ID/Staff ID

## Quick Fix Steps

### Step 1: Check if user exists
```bash
cd backend
python manage.py check_user <student_id_or_username>
```

### Step 2: If user doesn't exist, create one

**Option A: Create superuser (for admin/librarian)**
```bash
python manage.py createsuperuser
```
Follow the prompts to create an admin account.

**Option B: Create via Django admin**
1. Go to http://localhost:8000/admin
2. Login with superuser credentials
3. Click "Users" → "Add User"
4. Fill in the form and save

**Option C: Register via frontend**
1. Go to http://localhost:3000/register
2. Fill in registration form
3. Login to admin panel and approve the user

### Step 3: If user exists but can't login

**Check if account is active:**
```bash
python manage.py check_user <student_id> --activate
```

**Reset password:**
```bash
python manage.py check_user <student_id> --set-password newpassword123
```

### Step 4: Test login

**Via API (using curl):**
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"student_id":"STU001","password":"yourpassword"}'
```

**Via Frontend:**
1. Go to http://localhost:3000/login
2. Enter Student ID and password
3. Click "Sign In"

## Example: Create Test Accounts

### Create Student Account
```bash
cd backend
python manage.py shell
```

Then in Python shell:
```python
from django.contrib.auth import get_user_model
User = get_user_model()

# Create student
student = User.objects.create_user(
    username='STU001',
    student_id='STU001',
    password='student123',
    full_name='Test Student',
    email='student@test.com',
    role='STUDENT',
    is_active=True
)
print(f"Created student: {student.student_id}")
```

### Create Librarian Account
```python
librarian = User.objects.create_user(
    username='LIB001',
    staff_id='LIB001',
    password='librarian123',
    full_name='Test Librarian',
    email='librarian@test.com',
    role='LIBRARIAN',
    is_active=True
)
print(f"Created librarian: {librarian.staff_id}")
```

Exit shell with `exit()`

## Test Credentials

After creating accounts, test with:

**Student Login:**
- ID: `STU001`
- Password: `student123`

**Librarian Login:**
- ID: `LIB001`
- Password: `librarian123`

## Troubleshooting

### Error: "Invalid ID or password"
- Check if user exists: `python manage.py check_user <id>`
- Verify password is correct
- Try resetting password

### Error: "Account pending approval"
- User account is not active
- Activate with: `python manage.py check_user <id> --activate`
- Or approve via admin panel

### Error: "Cannot access portal"
- User role doesn't match portal
- Student portal: STUDENT, WORKING roles
- Librarian portal: LIBRARIAN, ADMIN roles
- Staff portal: STAFF, WORKING, ADMIN roles

## Quick Commands Reference

```bash
# Check user
python manage.py check_user STU001

# Activate user
python manage.py check_user STU001 --activate

# Set password
python manage.py check_user STU001 --set-password newpass123

# Do both at once
python manage.py check_user STU001 --activate --set-password newpass123

# Create superuser
python manage.py createsuperuser

# List all users
python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); [print(f'{u.username} - {u.role} - Active: {u.is_active}') for u in User.objects.all()]"
```

## Prevention

To avoid this issue in the future:
1. Always activate accounts after registration
2. Use strong, memorable passwords
3. Document test account credentials
4. Use Django admin to manage users
