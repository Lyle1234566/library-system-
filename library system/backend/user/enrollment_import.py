from __future__ import annotations

import csv
from dataclasses import dataclass
from io import StringIO
from pathlib import Path

from .models import EnrollmentRecord

ENROLLMENT_TEMPLATE_COLUMNS = (
    'student_id',
    'full_name',
    'school_email',
    'program',
    'year_level',
    'academic_term',
    'is_currently_enrolled',
    'notes',
)


class EnrollmentImportError(ValueError):
    pass


@dataclass(frozen=True)
class EnrollmentImportResult:
    created_count: int
    updated_count: int
    skipped_count: int
    skipped_rows: list[str]


def parse_bool(value: str | None, default: bool = True) -> bool:
    if value is None or value == '':
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'y', 'on'}


def _import_reader(reader: csv.DictReader, fallback_term: str = '') -> EnrollmentImportResult:
    if not reader.fieldnames or 'student_id' not in reader.fieldnames:
        raise EnrollmentImportError('CSV must include a student_id column.')

    created_count = 0
    updated_count = 0
    skipped_rows: list[str] = []

    for row_number, row in enumerate(reader, start=2):
        student_id = str(row.get('student_id') or '').strip()
        if not student_id:
            skipped_rows.append(f'Row {row_number}: missing student_id.')
            continue

        defaults = {
            'full_name': str(row.get('full_name') or '').strip(),
            'school_email': str(row.get('school_email') or '').strip().lower(),
            'program': str(row.get('program') or '').strip(),
            'year_level': str(row.get('year_level') or '').strip(),
            'academic_term': str(row.get('academic_term') or fallback_term).strip(),
            'is_currently_enrolled': parse_bool(row.get('is_currently_enrolled'), default=True),
            'notes': str(row.get('notes') or '').strip(),
        }

        _, created = EnrollmentRecord.objects.update_or_create(
            student_id=student_id.upper(),
            defaults=defaults,
        )
        if created:
            created_count += 1
        else:
            updated_count += 1

    return EnrollmentImportResult(
        created_count=created_count,
        updated_count=updated_count,
        skipped_count=len(skipped_rows),
        skipped_rows=skipped_rows[:20],
    )


def import_enrollment_csv_text(csv_text: str, fallback_term: str = '') -> EnrollmentImportResult:
    reader = csv.DictReader(StringIO(csv_text))
    return _import_reader(reader, fallback_term=fallback_term)


def import_enrollment_csv_file(uploaded_file, fallback_term: str = '') -> EnrollmentImportResult:
    raw_content = uploaded_file.read()
    if isinstance(raw_content, bytes):
        try:
            csv_text = raw_content.decode('utf-8-sig')
        except UnicodeDecodeError as exc:
            raise EnrollmentImportError('CSV must be UTF-8 encoded.') from exc
    else:
        csv_text = str(raw_content)

    return import_enrollment_csv_text(csv_text, fallback_term=fallback_term)


def import_enrollment_csv_path(csv_path: Path, fallback_term: str = '') -> EnrollmentImportResult:
    try:
        csv_text = csv_path.read_text(encoding='utf-8-sig')
    except FileNotFoundError as exc:
        raise EnrollmentImportError(f'CSV file not found: {csv_path}') from exc

    return import_enrollment_csv_text(csv_text, fallback_term=fallback_term)


def get_enrollment_summary() -> dict[str, int | str | list[str] | None]:
    total_records = EnrollmentRecord.objects.count()
    active_records = EnrollmentRecord.objects.filter(is_currently_enrolled=True).count()
    latest_term = (
        EnrollmentRecord.objects.exclude(academic_term='')
        .order_by('-updated_at')
        .values_list('academic_term', flat=True)
        .first()
    )
    last_updated = EnrollmentRecord.objects.order_by('-updated_at').values_list('updated_at', flat=True).first()

    return {
        'total_records': total_records,
        'active_records': active_records,
        'inactive_records': total_records - active_records,
        'latest_term': latest_term or None,
        'last_updated_at': last_updated.isoformat() if last_updated else None,
        'template_columns': list(ENROLLMENT_TEMPLATE_COLUMNS),
    }
