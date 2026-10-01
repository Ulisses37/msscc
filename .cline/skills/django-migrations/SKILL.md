---
name: django-migrations
description: Create, review, or apply Django migrations in backend/. Use when a model changes, makemigrations or migrate is needed, a migration conflict appears, or showmigrations looks wrong. The dev database is shared by the whole team, so nothing is applied without human approval.
---

# Django migrations

## Ground rules
- The dev PostgreSQL database is shared by all seven developers. `migrate` changes it for everyone. Never run `migrate` without explicit approval, and remind the human to announce it in Discord.
- Never edit the database directly: no `dbshell`, raw SQL, `--fake`, `--fake-initial`, or edits to the `django_migrations` table. If one seems necessary, stop and explain why to the human.
- Never edit or delete a migration that is already on `main` or already applied to the shared DB. Fix forward with a new migration.
- Never point Django at a production database. Use `DJANGO_SETTINGS_MODULE=config.settings.development` (set in `.env`, which Cline does not read).
- All commands run from `backend/` with the venv active.

## Steps

1. **Check the current state (read-only, no approval needed).**
   ```powershell
   python manage.py showmigrations <app>
   python manage.py makemigrations --check --dry-run
   ```
   `--check` exits non-zero if a model change has no migration yet.

2. **Preview the migration before writing it.**
   ```powershell
   python manage.py makemigrations <app> --dry-run --verbosity 3
   ```
   Read the operations. Watch for:
   - `RemoveField` + `AddField` on what was meant to be a rename. That drops the column and its data. Use `RenameField` instead.
   - A new non-nullable field on a table with rows. It needs a default or a two-step migration.
   - `AlterField` that shrinks `max_length` or changes type. It can fail or truncate existing data.
   - Changes to `accounts.AdminUser`. It is `AUTH_USER_MODEL`; keep `is_staff` and `is_superuser`.

3. **Write the migration (approval required).**
   ```powershell
   python manage.py makemigrations <app> --name <short_description>
   ```
   `makemigrations` asks interactive questions when it suspects a rename. Cline's terminal cannot answer them. When a rename is possible, ask the human to run the command in their own terminal, or write the `RenameField` migration by hand as a file edit.

4. **Review the generated file.** Show the human the operations and the SQL:
   ```powershell
   python manage.py sqlmigrate <app> <migration_number>
   ```
   Commit the migration in the same subtask as the model change.

5. **Apply (approval required, human announces first).**
   ```powershell
   python manage.py migrate <app>
   ```
   Then run `python manage.py showmigrations <app>` to confirm `[X]` on the new migration.

## Conflicts
- "Conflicting migrations detected" means two branches added migrations with the same parent. After syncing with `main`, preview and then (with approval) run `python manage.py makemigrations --merge`. Review the merge file before committing.
- `InconsistentMigrationHistory` or a "relation already exists" error means the shared DB does not match the files. Stop and hand off to the human; do not attempt `--fake`.

## Rollback
Reversing a migration on the shared DB (`python manage.py migrate <app> <previous_number>`) affects everyone and can drop data. Explain the impact and get approval first.
