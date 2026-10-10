from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("partners", "0004_rename_category_partner_category_en_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="partner",
            name="media_is_visible",
            field=models.BooleanField(default=True),
        ),
    ]
