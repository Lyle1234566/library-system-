from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0027_teacherrecord'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            ALTER TABLE user_teacherrecord
                ADD COLUMN IF NOT EXISTS academic_term varchar(80) NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS full_name varchar(100) NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS school_email varchar(254) NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS department varchar(120) NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '',
                ADD COLUMN IF NOT EXISTS created_at timestamptz,
                ADD COLUMN IF NOT EXISTS updated_at timestamptz;
            UPDATE user_teacherrecord SET created_at = now() WHERE created_at IS NULL;
            UPDATE user_teacherrecord SET updated_at = now() WHERE updated_at IS NULL;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
