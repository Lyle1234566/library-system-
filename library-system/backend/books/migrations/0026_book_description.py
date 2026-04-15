from django.db import migrations, models


def add_or_normalize_description_column(apps, schema_editor):
    Book = apps.get_model('books', 'Book')
    table_name = Book._meta.db_table
    quoted_table = schema_editor.quote_name(table_name)

    with schema_editor.connection.cursor() as cursor:
        existing_columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor, table_name
            )
        }

    if 'description' not in existing_columns:
        schema_editor.execute(
            f"ALTER TABLE {quoted_table} ADD COLUMN description text NOT NULL DEFAULT ''"
        )
        return

    quoted_column = schema_editor.quote_name('description')
    schema_editor.execute(
        f"UPDATE {quoted_table} SET {quoted_column} = '' WHERE {quoted_column} IS NULL"
    )
    schema_editor.execute(
        f"ALTER TABLE {quoted_table} ALTER COLUMN {quoted_column} SET DEFAULT ''"
    )
    schema_editor.execute(
        f"ALTER TABLE {quoted_table} ALTER COLUMN {quoted_column} SET NOT NULL"
    )


class Migration(migrations.Migration):

    dependencies = [
        ('books', '0025_renewalrequest'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    add_or_normalize_description_column,
                    migrations.RunPython.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='book',
                    name='description',
                    field=models.TextField(blank=True, default=''),
                ),
            ],
        ),
    ]
