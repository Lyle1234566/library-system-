from __future__ import annotations

from dataclasses import asdict, dataclass

from .models import EnrollmentRecord, TeacherRecord, User


@dataclass(frozen=True)
class IdentifierAvailability:
    available: bool
    reason: str
    message: str

    def to_dict(self) -> dict[str, str | bool]:
        return asdict(self)


def normalize_identifier(value: str | None) -> str:
    return str(value or '').strip()


def get_student_identifier_status(identifier: str | None) -> IdentifierAvailability:
    normalized = normalize_identifier(identifier)
    if not normalized:
        return IdentifierAvailability(
            available=False,
            reason='missing_identifier',
            message='Student ID is required',
        )

    if User.objects.filter(student_id__iexact=normalized).exists():
        return IdentifierAvailability(
            available=False,
            reason='taken',
            message='Student ID is already taken',
        )

    enrollment_record = EnrollmentRecord.objects.filter(student_id__iexact=normalized).first()
    if enrollment_record is None:
        return IdentifierAvailability(
            available=False,
            reason='not_enrolled',
            message='Student ID was not found in the current enrollment list.',
        )

    if not enrollment_record.is_currently_enrolled:
        return IdentifierAvailability(
            available=False,
            reason='inactive_enrollment',
            message='Student ID is not marked as currently enrolled.',
        )

    return IdentifierAvailability(
        available=True,
        reason='available',
        message='Student ID is verified for current enrollment.',
    )


def get_teacher_identifier_status(identifier: str | None) -> IdentifierAvailability:
    normalized = normalize_identifier(identifier)
    if not normalized:
        return IdentifierAvailability(
            available=False,
            reason='missing_identifier',
            message='Faculty ID is required',
        )

    if User.objects.filter(staff_id__iexact=normalized).exists():
        return IdentifierAvailability(
            available=False,
            reason='taken',
            message='Faculty ID is already taken',
        )

    teacher_record = TeacherRecord.objects.filter(staff_id__iexact=normalized).first()
    if teacher_record is None:
        return IdentifierAvailability(
            available=False,
            reason='not_in_teacher_records',
            message='Faculty ID was not found in the teacher records.',
        )

    if not teacher_record.is_active:
        return IdentifierAvailability(
            available=False,
            reason='inactive_teacher_record',
            message='Faculty ID is not marked as active in the teacher records.',
        )

    return IdentifierAvailability(
        available=True,
        reason='available',
        message='Faculty ID is verified in the teacher records.',
    )


def get_identifier_status(role: str, identifier: str | None) -> IdentifierAvailability:
    normalized_role = normalize_identifier(role).upper()
    if normalized_role == 'TEACHER':
        return get_teacher_identifier_status(identifier)
    return get_student_identifier_status(identifier)
