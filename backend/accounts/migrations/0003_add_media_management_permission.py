from django.db import migrations


def add_media_management_permission(apps, schema_editor):
    AdminUser = apps.get_model("accounts", "AdminUser")
    database = schema_editor.connection.alias

    for admin in AdminUser.objects.using(database).only("pk", "permissions_data").iterator():
        permissions = admin.permissions_data
        if "Media_Management" not in permissions:
            permissions["Media_Management"] = False
            AdminUser.objects.using(database).filter(pk=admin.pk).update(
                permissions_data=permissions
            )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_alter_adminuser_managers"),
    ]

    operations = [
        migrations.RunPython(
            add_media_management_permission,
            migrations.RunPython.noop,
        ),
    ]
