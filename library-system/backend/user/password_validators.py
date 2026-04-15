import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


class PasswordCompositionValidator:
    def validate(self, password, user=None):
        errors = []

        if not re.search(r"\d", password):
            errors.append(_("Password must contain at least 1 number (0-9)."))

        if not re.search(r"[^A-Za-z0-9\s]", password):
            errors.append(
                _("Password must contain at least 1 special character (for example: ! @ # $ %).")
            )

        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return _(
            "Your password must contain at least 1 number (0-9) and 1 special character (for example: ! @ # $ %)."
        )
