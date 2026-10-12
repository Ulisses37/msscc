from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("media", "0006_consolidate_media_and_static_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="mediaasset",
            name="is_visible_to_gallery",
            field=models.BooleanField(default=False),
        ),
    ]
