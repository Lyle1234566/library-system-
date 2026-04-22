from __future__ import annotations

import csv
from dataclasses import dataclass
from io import StringIO
from pathlib import Path

from .models import TeacherRecord

TEACHER_TEMPLATE_COLUMNS = (
    'staff_id',
    'full_name',
    'school_email',
    'department',
    'academic_term',
    'is_active',
    'notes',
)


class TeacherImportError(ValueError):
    pass


@dataclass(frozen=True)
class TeacherImportResult:
    created_count: int
    updated_count: int
    skipped_count: int
    skipped_rows: list[str]


def parse_bool(value: str | None, default: bool = True) -> bool:
    if value is None or value == '':
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'y', 'on'}


def _import_reader(reader: csv.DictReader, fallback_term: str = '') -> TeacherImportResult:
    if not reader.fieldnames or 'staff_id' not in reader.fieldnames:
        raise TeacherImportError('CSV must include a staff_id column.')

    created_count = 0
    updated_count = 0
    skipped_rows: list[str] = []

    for row_number, row in enumerate(reader, start=2):
        staff_id = str(row.get('staff_id') or '').strip()
        if not staff_id:
            skipped_rows.append(f'Row {row_number}: missing staff_id.')
            continue

        defaults = {
            'full_name': str(row.get('full_name') or '').strip(),
            'school_email': str(row.get('school_email') or '').strip().lower(),
            'department': str(row.get('department') or '').strip(),
            'academic_term': str(row.get('academic_term') or fallback_term).strip(),
            'is_active': parse_bool(row.get('is_active'), default=True),
            'notes': str(row.get('notes') or '').strip(),
        }

        _, created = TeacherRecord.objects.update_or_create(
            staff_id=staff_id.upper(),
            defaults=defaults,
        )
        if created:
            created_count += 1
        else:
            updated_count += 1

    return TeacherImportResult(
        created_count=created_count,
        updated_count=updated_count,
        skipped_count=len(skipped_rows),
        skipped_rows=skipped_rows[:20],
    )


def import_teacher_csv_text(csv_text: str, fallback_term: str = '') -> TeacherImportResult:
    reader = csv.DictReader(StringIO(csv_text))
    return _import_reader(reader, fallback_term=fallback_term)


def import_teacher_csv_file(uploaded_file, fallback_term: str = '') -> TeacherImportResult:
    raw_content = uploaded_file.read()
    if isinstance(raw_content, bytes):
        try:
            csv_text = raw_content.decode('utf-8-sig')
        except UnicodeDecodeError as exc:
            raise TeacherImportError('CSV must be UTF-8 encoded.') from exc
    else:
        csv_text = str(raw_content)

    return import_teacher_csv_text(csv_text, fallback_term=fallback_term)


def import_teacher_csv_path(csv_path: Path, fallback_term: str = '') -> TeacherImportResult:
    try:
        csv_text = csv_path.read_text(encoding='utf-8-sig')
    except FileNotFoundError as exc:
        raise TeacherImportError(f'CSV file not found: {csv_path}') from exc

    return import_teacher_csv_text(csv_text, fallback_term=fallback_term)


def get_teacher_records_summary() -> dict[str, int | str | list[str] | None]:
    total_records = TeacherRecord.objects.count()
    active_records = TeacherRecord.objects.filter(is_active=True).count()
    latest_term = (
        TeacherRecord.objects.exclude(academic_term='')
        .order_by('-updated_at')
        .values_list('academic_term', flat=True)
        .first()
    )
    last_updated = TeacherRecord.objects.order_by('-updated_at').values_list('updated_at', flat=True).first()

    return {
        'total_records': total_records,
        'active_records': active_records,
        'inactive_records': total_records - active_records,
        'latest_term': latest_term or None,
        'last_updated_at': last_updated.isoformat() if last_updated else None,
        'template_columns': list(TEACHER_TEMPLATE_COLUMNS),
    }
