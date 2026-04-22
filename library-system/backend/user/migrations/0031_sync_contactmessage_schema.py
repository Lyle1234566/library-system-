from django.db import migrations, models
import django.db.models.deletion


CONTACTMESSAGE_SCHEMA_SQL = """
ALTER TABLE user_contactmessage
ADD COLUMN IF NOT EXISTS internal_notes text NOT NULL DEFAULT '';

ALTER TABLE user_contactmessage
ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'NEW';

ALTER TABLE user_contactmessage
ADD COLUMN IF NOT EXISTS handled_at timestamp with time zone NULL;

ALTER TABLE user_contactmessage
ADD COLUMN IF NOT EXISTS handled_by_id bigint NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_contactmessage_handled_by_id_cc882f00_fk_user_user_id'
    ) THEN
        ALTER TABLE user_contactmessage
        ADD CONSTRAINT user_contactmessage_handled_by_id_cc882f00_fk_user_user_id
        FOREIGN KEY (handled_by_id) REFERENCES user_user(id)
        DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_contactmessage_handled_by_id_cc882f00
ON user_contactmessage (handled_by_id);
"""


CONTACTMESSAGE_SCHEMA_REVERSE_SQL = """
ALTER TABLE user_contactmessage
DROP CONSTRAINT IF EXISTS user_contactmessage_handled_by_id_cc882f00_fk_user_user_id;

DROP INDEX IF EXISTS user_contactmessage_handled_by_id_cc882f00;

ALTER TABLE user_contactmessage DROP COLUMN IF EXISTS handled_by_id;
ALTER TABLE user_contactmessage DROP COLUMN IF EXISTS handled_at;
ALTER TABLE user_contactmessage DROP COLUMN IF EXISTS status;
ALTER TABLE user_contactmessage DROP COLUMN IF EXISTS internal_notes;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0030_alter_notification_notification_type_contact_message'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=CONTACTMESSAGE_SCHEMA_SQL,
                    reverse_sql=CONTACTMESSAGE_SCHEMA_REVERSE_SQL,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='contactmessage',
                    name='handled_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='contactmessage',
                    name='handled_by',
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='handled_contact_messages',
                        to='user.user',
                    ),
                ),
                migrations.AddField(
                    model_name='contactmessage',
                    name='internal_notes',
                    field=models.TextField(blank=True, default=''),
                ),
                migrations.AddField(
                    model_name='contactmessage',
                    name='status',
                    field=models.CharField(
                        choices=[
                            ('NEW', 'New'),
                            ('IN_PROGRESS', 'In progress'),
                            ('RESOLVED', 'Resolved'),
                        ],
                        default='NEW',
                        max_length=20,
                    ),
                ),
            ],
        ),
    ]
