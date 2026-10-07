from django.db import migrations

CREATE_FUNCTION_SQL = """
CREATE FUNCTION bump_admin_table_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE donations_admin_table_revision
    SET revision = revision + 1,
        changed_at = CURRENT_TIMESTAMP
    WHERE table_name = TG_ARGV[0];

    RETURN NULL;
END;
$$;
"""

CREATE_DONATIONS_TRIGGER_SQL = """
CREATE TRIGGER donations_bump_admin_table_revision
AFTER INSERT OR UPDATE OR DELETE
ON donations_donation
FOR EACH STATEMENT
EXECUTE FUNCTION bump_admin_table_revision('donations');
"""

CREATE_MEMBERSHIPS_TRIGGER_SQL = """
CREATE TRIGGER memberships_bump_admin_table_revision
AFTER INSERT OR UPDATE OR DELETE
ON donations_membership
FOR EACH STATEMENT
EXECUTE FUNCTION bump_admin_table_revision('memberships');
"""

DROP_DONATIONS_TRIGGER_SQL = """
DROP TRIGGER IF EXISTS donations_bump_admin_table_revision
ON donations_donation;
"""

DROP_MEMBERSHIPS_TRIGGER_SQL = """
DROP TRIGGER IF EXISTS memberships_bump_admin_table_revision
ON donations_membership;
"""

DROP_FUNCTION_SQL = "DROP FUNCTION IF EXISTS bump_admin_table_revision();"


def create_admin_table_revision_triggers(apps, schema_editor):
    """Create PostgreSQL triggers that invalidate changed admin table data."""
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(CREATE_FUNCTION_SQL)
        cursor.execute(CREATE_DONATIONS_TRIGGER_SQL)
        cursor.execute(CREATE_MEMBERSHIPS_TRIGGER_SQL)


def remove_admin_table_revision_triggers(apps, schema_editor):
    """Remove PostgreSQL triggers and their shared revision function."""
    if schema_editor.connection.vendor != "postgresql":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute(DROP_DONATIONS_TRIGGER_SQL)
        cursor.execute(DROP_MEMBERSHIPS_TRIGGER_SQL)
        cursor.execute(DROP_FUNCTION_SQL)


class Migration(migrations.Migration):

    dependencies = [
        ("donations", "0004_admin_table_revision"),
    ]

    operations = [
        migrations.RunPython(
            create_admin_table_revision_triggers,
            reverse_code=remove_admin_table_revision_triggers,
        ),
    ]
