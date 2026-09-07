from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("volunteer_slots", "0001_initial"),
        ("volunteer_signup", "0004_remove_volunteersignup_state"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(
                    name="VolunteerSlot",
                ),
            ],
        ),
    ]
