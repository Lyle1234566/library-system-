from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

from .models import ContactMessage, Notification
from .registration_rules import get_student_identifier_status, get_teacher_identifier_status

User = get_user_model()
REMINDER_EMAIL_REQUIRED_MESSAGE = "Email is required so due-date reminders can be sent."


def normalize_unique_email(value, instance=None):
    if not value:
        return value

    normalized = value.strip().lower()
    queryset = User.objects.filter(email__iexact=normalized)
    if instance is not None:
        queryset = queryset.exclude(pk=instance.pk)

    if queryset.exists():
        raise serializers.ValidationError("A user with this email address already exists.")

    return normalized


class UserSerializer(serializers.ModelSerializer):
    """Serializer for user profile data"""

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'student_id',
            'staff_id',
            'email',
            'email_verified',
            'full_name',
            'avatar',
            'role',
            'is_working_student',
            'is_active',
            'date_joined',
        ]
        read_only_fields = [
            'id',
            'date_joined',
            'is_active',
            'student_id',
            'staff_id',
            'username',
            'is_working_student',
            'email_verified',
        ]

    def validate_email(self, value):
        return normalize_unique_email(value, instance=self.instance)

    def validate(self, attrs):
        role = attrs.get('role', getattr(self.instance, 'role', None))
        email = attrs.get('email', getattr(self.instance, 'email', None))

        if role in {'STUDENT', 'TEACHER'} and not email:
            raise serializers.ValidationError({
                'email': REMINDER_EMAIL_REQUIRED_MESSAGE,
            })

        return attrs


class ProfileSerializer(UserSerializer):
    """Serializer for user-controlled profile updates."""

    class Meta(UserSerializer.Meta):
        read_only_fields = UserSerializer.Meta.read_only_fields + [
            'email',
            'role',
        ]

    def validate(self, attrs):
        errors = {}
        instance = self.instance
        initial_data = getattr(self, 'initial_data', {}) or {}

        if instance is not None and 'email' in initial_data:
            submitted_email = (initial_data.get('email') or '').strip().lower()
            current_email = (instance.email or '').strip().lower()
            if submitted_email != current_email:
                errors['email'] = 'Use the update-email endpoint to change your email address.'

        if instance is not None and 'role' in initial_data:
            submitted_role = str(initial_data.get('role') or '').strip().upper()
            current_role = str(getattr(instance, 'role', '') or '').strip().upper()
            if submitted_role != current_role:
                errors['role'] = 'Role cannot be changed from the profile endpoint.'

        if errors:
            raise serializers.ValidationError(errors)

        return attrs


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for student and teacher self-registration."""

    role = serializers.ChoiceField(
        choices=(
            ('STUDENT', 'Student'),
            ('TEACHER', 'Teacher'),
        ),
        required=False,
        default='STUDENT',
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    email = serializers.EmailField(
        required=True,
        error_messages={
            'required': REMINDER_EMAIL_REQUIRED_MESSAGE,
        },
    )

    class Meta:
        model = User
        fields = [
            'role',
            'student_id',
            'staff_id',
            'full_name',
            'email',
            'password',
            'password_confirm',
        ]
        extra_kwargs = {
            'student_id': {'required': False},
            'staff_id': {'required': False},
            'full_name': {'required': True},
        }

    def validate_student_id(self, value):
        status = get_student_identifier_status(value)
        if not status.available:
            raise serializers.ValidationError(status.message)
        return value.strip()

    def validate_staff_id(self, value):
        status = get_teacher_identifier_status(value)
        if not status.available:
            raise serializers.ValidationError(status.message)
        return value.strip()

    def validate_email(self, value):
        return normalize_unique_email(value)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': "Passwords do not match."
            })

        role = attrs.get('role', 'STUDENT')
        student_id = attrs.get('student_id')
        staff_id = attrs.get('staff_id')

        if role == 'STUDENT' and not student_id:
            raise serializers.ValidationError({
                'student_id': "Student ID is required for student registration."
            })

        if role == 'TEACHER' and not staff_id:
            raise serializers.ValidationError({
                'staff_id': "Faculty ID is required for teacher registration."
            })

        if not attrs.get('email'):
            raise serializers.ValidationError({
                'email': REMINDER_EMAIL_REQUIRED_MESSAGE,
            })

        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        role = validated_data.pop('role', 'STUDENT')
        username = validated_data.get('student_id') or validated_data.get('staff_id')
        user = User.objects.create_user(
            username=username,
            student_id=validated_data.get('student_id') if role == 'STUDENT' else None,
            staff_id=validated_data.get('staff_id') if role == 'TEACHER' else None,
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            email=validated_data.get('email'),
            role=role,
            is_active=False,
        )
        return user


class LoginSerializer(serializers.Serializer):
    """Serializer for user login with ID (student, staff, or username)"""

    portal = serializers.ChoiceField(
        choices=(
            ('student', 'Student'),
            ('teacher', 'Teacher'),
            ('librarian', 'Librarian'),
            ('staff', 'Staff'),
        ),
        required=False,
        allow_null=True,
    )
    student_id = serializers.CharField(required=True)
    password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change"""
    
    old_password = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    new_password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'}
    )
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': "New passwords do not match."
            })
        return attrs
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """Request a short reset code to be sent to an email address."""

    email = serializers.EmailField(required=True)

    def validate_email(self, value: str) -> str:
        return value.lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Confirm a reset code and set a new password."""

    email = serializers.EmailField(required=True)
    code = serializers.CharField(required=True, max_length=10)
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'},
    )
    new_password_confirm = serializers.CharField(
        required=True,
        write_only=True,
        style={'input_type': 'password'},
    )

    def validate_email(self, value: str) -> str:
        return value.lower()

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': "New passwords do not match."
            })
        return attrs


class PasswordResetVerifySerializer(serializers.Serializer):
    """Validate a reset code before allowing password change."""

    email = serializers.EmailField(required=True)
    code = serializers.CharField(required=True, max_length=10)

    def validate_email(self, value: str) -> str:
        return value.lower()


class ContactMessageSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    subject = serializers.CharField(max_length=200, required=False, allow_blank=True)
    message = serializers.CharField()

    def validate_email(self, value: str) -> str:
        return value.lower()


def get_contact_message_sender_role(user) -> str:
    if not user:
        return 'Guest'
    role = getattr(user, 'role', '')
    if role == 'WORKING' or (role == 'STUDENT' and getattr(user, 'is_working_student', False)):
        return 'Working Student'
    return {
        'STUDENT': 'Student',
        'TEACHER': 'Teacher',
        'LIBRARIAN': 'Librarian',
        'STAFF': 'Staff',
        'ADMIN': 'Admin',
    }.get(role, 'Guest')


class ContactMessageRecordSerializer(serializers.ModelSerializer):
    sender_role = serializers.SerializerMethodField()
    sender_identifier = serializers.SerializerMethodField()
    handled_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ContactMessage
        fields = (
            'id',
            'user_id',
            'name',
            'email',
            'subject',
            'message',
            'internal_notes',
            'status',
            'created_at',
            'handled_at',
            'handled_by_id',
            'handled_by_name',
            'sender_role',
            'sender_identifier',
        )
        read_only_fields = fields

    def get_sender_role(self, obj: ContactMessage) -> str:
        return get_contact_message_sender_role(obj.user)

    def get_sender_identifier(self, obj: ContactMessage) -> str:
        if not obj.user:
            return ''
        return str(getattr(obj.user, 'staff_id', '') or getattr(obj.user, 'student_id', '') or '').strip()

    def get_handled_by_name(self, obj: ContactMessage) -> str | None:
        if not obj.handled_by:
            return None
        return str(getattr(obj.handled_by, 'full_name', '') or getattr(obj.handled_by, 'username', '') or '').strip() or None


class ContactMessageUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ContactMessage.STATUS_CHOICES, required=False)
    internal_notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError('At least one field must be provided.')
        if 'internal_notes' in attrs:
            attrs['internal_notes'] = attrs['internal_notes'].strip()
        return attrs


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            'id',
            'notification_type',
            'title',
            'message',
            'data',
            'is_read',
            'read_at',
            'created_at',
        )
        read_only_fields = fields
