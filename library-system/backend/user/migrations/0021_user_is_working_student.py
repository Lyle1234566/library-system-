from django.db import migrations, models


def migrate_working_role_to_student_flag(apps, schema_editor):
    User = apps.get_model('user', 'User')
    User.objects.filter(role='WORKING').update(
        role='STUDENT',
        is_working_student=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0020_delete_approvedteacher'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='is_working_student',
            field=models.BooleanField(
                default=False,
                help_text='Grants working-student desk access while keeping the base student account.',
            ),
        ),
        migrations.RunPython(
            migrate_working_role_to_student_flag,
            migrations.RunPython.noop,
        ),
    ]
