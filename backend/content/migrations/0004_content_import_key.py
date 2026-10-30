from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0003_content_image_width"),
    ]

    operations = [
        migrations.AddField(
            model_name="content",
            name="import_key",
            field=models.CharField(
                blank=True,
                max_length=255,
                null=True,
                unique=True,
            ),
        ),
    ]