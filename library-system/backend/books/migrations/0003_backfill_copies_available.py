from django.db import migrations


def set_copies_available(apps, schema_editor):
    Book = apps.get_model('books', 'Book')
    Book.objects.filter(available=False).update(copies_available=0)


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0002_book_copies_available'),
    ]

    operations = [
        migrations.RunPython(set_copies_available, migrations.RunPython.noop),
    ]
