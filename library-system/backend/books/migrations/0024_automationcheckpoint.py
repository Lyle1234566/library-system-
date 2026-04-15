from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0023_borrowrequest_last_reported_at_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='AutomationCheckpoint',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=64, unique=True)),
                ('last_attempted_on', models.DateField(blank=True, null=True)),
                ('last_attempted_at', models.DateTimeField(blank=True, null=True)),
                ('last_run_on', models.DateField(blank=True, null=True)),
                ('last_run_at', models.DateTimeField(blank=True, null=True)),
                ('last_error', models.TextField(blank=True, default='')),
                ('last_stats', models.JSONField(blank=True, default=dict)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['key'],
            },
        ),
    ]
