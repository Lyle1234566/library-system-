import logging

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import AutomationCheckpoint, run_borrow_automation

logger = logging.getLogger(__name__)

BORROW_AUTOMATION_CHECKPOINT_KEY = 'borrow_automation_daily'


def run_daily_borrow_automation_if_needed(*, as_of=None) -> bool:
    if not getattr(settings, 'AUTO_RUN_BORROW_AUTOMATION_DAILY', True):
        return False

    as_of_date = as_of or timezone.localdate()
    checkpoint_id: int | None = None

    with transaction.atomic():
        checkpoint, _ = AutomationCheckpoint.objects.select_for_update().get_or_create(
            key=BORROW_AUTOMATION_CHECKPOINT_KEY
        )
        if checkpoint.last_attempted_on == as_of_date:
            return False

        checkpoint.last_attempted_on = as_of_date
        checkpoint.last_attempted_at = timezone.now()
        checkpoint.last_error = ''
        checkpoint.save()
        checkpoint_id = checkpoint.pk

    try:
        stats = run_borrow_automation(as_of=as_of_date, send_reminders=True)
    except Exception as exc:
        logger.exception('Automatic daily borrow automation failed: %s', exc)
        if checkpoint_id is not None:
            AutomationCheckpoint.objects.filter(pk=checkpoint_id).update(last_error=str(exc))
        return False

    if checkpoint_id is not None:
        AutomationCheckpoint.objects.filter(pk=checkpoint_id).update(
            last_run_on=as_of_date,
            last_run_at=timezone.now(),
            last_error='',
            last_stats=stats,
        )
    return True
