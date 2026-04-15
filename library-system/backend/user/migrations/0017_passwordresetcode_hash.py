from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0016_notification'),
    ]

    operations = [
        migrations.AlterField(
            model_name='passwordresetcode',
            name='code',
            field=models.CharField(max_length=255),
        ),
    ]
