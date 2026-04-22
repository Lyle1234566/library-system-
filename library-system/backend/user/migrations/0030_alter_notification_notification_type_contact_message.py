from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0029_teacherrecord_drop_orphan_column'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('CONTACT_MESSAGE_RECEIVED', 'Contact message received'),
                    ('BORROW_APPROVED', 'Borrow approved'),
                    ('BORROW_REJECTED', 'Borrow rejected'),
                    ('RETURN_APPROVED', 'Return approved'),
                    ('RETURN_REJECTED', 'Return rejected'),
                    ('RENEWAL_REQUEST_SUBMITTED', 'Renewal request submitted'),
                    ('RENEWAL_REQUEST_REJECTED', 'Renewal request rejected'),
                    ('RENEWAL_SUCCESS', 'Renewal success'),
                    ('REPORT_SUBMITTED', 'Report submitted'),
                    ('FINE_CREATED', 'Fine created'),
                    ('FINE_PAID', 'Fine paid'),
                    ('FINE_WAIVED', 'Fine waived'),
                    ('RESERVATION_CREATED', 'Reservation created'),
                    ('RESERVATION_AVAILABLE', 'Reservation available'),
                    ('RESERVATION_EXPIRED', 'Reservation expired'),
                    ('RESERVATION_CANCELLED', 'Reservation cancelled'),
                    ('DUE_SOON', 'Due soon'),
                ],
                max_length=40,
            ),
        ),
    ]
