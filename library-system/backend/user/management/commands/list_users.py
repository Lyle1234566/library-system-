"""
Management command to list all users in the system.
Usage: python manage.py list_users
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'List all users in the system'

    def handle(self, *args, **options):
        users = User.objects.all().order_by('-date_joined')
        
        if not users.exists():
            self.stdout.write(self.style.WARNING('No users found in the database.'))
            self.stdout.write('\nCreate a superuser with:')
            self.stdout.write('  python manage.py createsuperuser')
            return
        
        self.stdout.write(self.style.SUCCESS(f'\nFound {users.count()} users:\n'))
        
        for user in users:
            status = 'ACTIVE' if user.is_active else 'INACTIVE'
            status_style = self.style.SUCCESS if user.is_active else self.style.WARNING
            
            login_id = user.student_id or user.staff_id or user.username
            
            self.stdout.write(f'  {status_style(status)} | {user.role:10} | {login_id:15} | {user.full_name}')
        
        self.stdout.write('\nTo check a specific user:')
        self.stdout.write('  python manage.py check_user <student_id>')
