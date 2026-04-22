from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0028_teacherrecord_add_missing_columns'),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE user_teacherrecord DROP COLUMN IF EXISTS is_active_for_registration;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
