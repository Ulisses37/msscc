import uuid

from django.db import migrations, models


def populate_cancellation_tokens(apps, schema_editor):
    """Assign a distinct cancellation token to each existing volunteer signup."""
    VolunteerSignup = apps.get_model("events", "VolunteerSignup")

    for signup in VolunteerSignup.objects.filter(cancellation_token__isnull=True).iterator():
        signup.cancellation_token = uuid.uuid4()
        signup.save(update_fields=["cancellation_token"])


class Migration(migrations.Migration):
    dependencies = [
        ("events", "0009_alter_volunteersignup_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="volunteersignup",
            name="cancellation_token",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.RunPython(
            code=populate_cancellation_tokens,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="volunteersignup",
            name="cancellation_token",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]