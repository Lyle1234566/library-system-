from django.db import migrations, models
import uuid


def backfill_receipts(apps, schema_editor):
    BorrowRequest = apps.get_model('books', 'BorrowRequest')
    existing = set(
        BorrowRequest.objects.exclude(receipt_number__isnull=True).values_list('receipt_number', flat=True)
    )
    requests = BorrowRequest.objects.filter(
        status__in=['APPROVED', 'RETURNED'],
        receipt_number__isnull=True,
    )
    for request in requests.iterator():
        receipt = None
        for _ in range(5):
            candidate = f"BRW-{uuid.uuid4().hex[:12].upper()}"
            if candidate not in existing:
                receipt = candidate
                break
        if not receipt:
            receipt = f"BRW-{uuid.uuid4().hex.upper()}"
        existing.add(receipt)
        BorrowRequest.objects.filter(pk=request.pk).update(receipt_number=receipt)


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0012_hold_request_admin_approval'),
    ]

    operations = [
        migrations.AddField(
            model_name='borrowrequest',
            name='receipt_number',
            field=models.CharField(blank=True, max_length=32, null=True, unique=True),
        ),
        migrations.RunPython(backfill_receipts, migrations.RunPython.noop),
    ]
