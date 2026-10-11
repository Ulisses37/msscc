from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("donations", "0006_membership_payment_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="donation",
            name="currency",
            field=models.CharField(default="usd", max_length=3),
        ),
        migrations.AddField(
            model_name="donation",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="membership",
            name="completed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]