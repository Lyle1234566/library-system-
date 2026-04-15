from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from user.enrollment_import import EnrollmentImportError, import_enrollment_csv_path


class Command(BaseCommand):
    help = 'Import student enrollment records from a CSV file.'

    def add_arguments(self, parser):
        parser.add_argument('csv_path', help='Path to the CSV file to import.')
        parser.add_argument(
            '--academic-term',
            default='',
            help='Fallback academic term when the CSV omits the academic_term column.',
        )

    def handle(self, *args, **options):
        csv_path = Path(options['csv_path']).expanduser()
        if not csv_path.exists():
            raise CommandError(f'CSV file not found: {csv_path}')

        fallback_term = str(options.get('academic_term') or '').strip()

        try:
            result = import_enrollment_csv_path(csv_path, fallback_term=fallback_term)
        except EnrollmentImportError as exc:
            raise CommandError(str(exc)) from exc

        for warning in result.skipped_rows:
            self.stdout.write(self.style.WARNING(f'Skipped: {warning}'))

        self.stdout.write(
            self.style.SUCCESS(
                'Enrollment import complete. '
                f'Created: {result.created_count}, '
                f'updated: {result.updated_count}, '
                f'skipped: {result.skipped_count}.'
            )
        )
