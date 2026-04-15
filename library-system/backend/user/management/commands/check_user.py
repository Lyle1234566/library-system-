"""
Management command to check user credentials and activate accounts.
Usage: python manage.py check_user <student_id_or_username>
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Check user credentials and activate account if needed'

    def add_arguments(self, parser):
        parser.add_argument('identifier', type=str, help='Student ID, Staff ID, or username')
        parser.add_argument('--activate', action='store_true', help='Activate the user account')
        parser.add_argument('--set-password', type=str, help='Set a new password for the user')

    def handle(self, *args, **options):
        identifier = options['identifier']
        
        # Find user
        user = (
            User.objects.filter(student_id=identifier).first()
            or User.objects.filter(staff_id=identifier).first()
            or User.objects.filter(username__iexact=identifier).first()
        )
        
        if not user:
            self.stdout.write(self.style.ERROR(f'User not found: {identifier}'))
            self.stdout.write(self.style.WARNING('\nTip: Create a user with:'))
            self.stdout.write('  python manage.py createsuperuser')
            return
        
        # Display user info
        self.stdout.write(self.style.SUCCESS(f'\nUser found!'))
        self.stdout.write(f'  ID: {user.id}')
        self.stdout.write(f'  Username: {user.username}')
        self.stdout.write(f'  Student ID: {user.student_id or "N/A"}')
        self.stdout.write(f'  Staff ID: {user.staff_id or "N/A"}')
        self.stdout.write(f'  Full Name: {user.full_name}')
        self.stdout.write(f'  Email: {user.email or "N/A"}')
        self.stdout.write(f'  Role: {user.role}')
        self.stdout.write(f'  Is Active: {user.is_active}')
        self.stdout.write(f'  Is Superuser: {user.is_superuser}')
        self.stdout.write(f'  Is Working Student: {user.is_working_student}')
        
        # Activate if requested
        if options['activate']:
            if user.is_active:
                self.stdout.write(self.style.WARNING('\nUser is already active'))
            else:
                user.is_active = True
                user.save()
                self.stdout.write(self.style.SUCCESS('\nUser activated!'))
        
        # Set password if requested
        if options['set_password']:
            new_password = options['set_password']
            user.set_password(new_password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f'\nPassword updated!'))
            self.stdout.write(f'  New password: {new_password}')
        
        # Show login instructions
        if not user.is_active:
            self.stdout.write(self.style.WARNING('\nUser is NOT active. Activate with:'))
            self.stdout.write(f'  python manage.py check_user {identifier} --activate')
        else:
            self.stdout.write(self.style.SUCCESS('\nUser can log in with:'))
            login_id = user.student_id or user.staff_id or user.username
            self.stdout.write(f'  ID: {login_id}')
            self.stdout.write(f'  Password: (use the password you set)')
