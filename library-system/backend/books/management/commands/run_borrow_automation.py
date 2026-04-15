from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.utils.dateparse import parse_date

from books.models import run_borrow_automation


class Command(BaseCommand):
    help = "Recalculate late fees for active borrows and send due-date reminder emails."

    def add_arguments(self, parser):
        parser.add_argument(
            '--as-of',
            type=str,
            help='Reference date in YYYY-MM-DD format (defaults to today).',
        )
        parser.add_argument(
            '--skip-reminders',
            action='store_true',
            help='Recalculate fees only, without sending reminder emails.',
        )

    def handle(self, *args, **options):
        reminder_days = getattr(settings, 'DUE_SOON_REMINDER_DAYS', 1)
        as_of_value = options.get('as_of')
        as_of_date = None
        if as_of_value:
            as_of_date = parse_date(as_of_value)
            if as_of_date is None:
                raise CommandError('Invalid --as-of date. Use YYYY-MM-DD format.')

        stats = run_borrow_automation(
            as_of=as_of_date,
            send_reminders=not options.get('skip_reminders', False),
        )

        self.stdout.write(self.style.SUCCESS('Borrow automation completed.'))
        self.stdout.write(f"Reminder window: {reminder_days} day(s) before due date")
        self.stdout.write(f"Processed: {stats['processed']}")
        self.stdout.write(f"Fees updated: {stats['fees_updated']}")
        self.stdout.write(f"Reminders sent: {stats['reminders_sent']}")
        self.stdout.write(f"Reminder failures: {stats['reminder_failures']}")
