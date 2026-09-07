from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("volunteer_signup", "0003_alter_volunteersignup_slot"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(
                    name="VolunteerSignup",
                ),
            ],
        ),
    ]
