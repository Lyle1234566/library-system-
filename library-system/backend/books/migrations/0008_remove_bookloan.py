from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0007_bookloan'),
    ]

    operations = [
        migrations.DeleteModel(
            name='BookLoan',
        ),
    ]
