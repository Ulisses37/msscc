---
name: run-checks
description: Run frontend lint, type-check, and tests plus backend Ruff, pytest, and Django checks, then report pass or fail in a table. Use before committing or opening a PR. Read-only - never applies fixes, never installs packages, never modifies files.
---

# Run checks

Report only. Never run a command that modifies code (`--fix`, `--write`, `ruff format`, `npm run lint -- --fix`), never install dependencies, never change git state. If a check fails, summarize it and stop; propose a fix as a file edit only when the human asks.

`<py>` means the backend venv interpreter: `backend\venv\Scripts\python.exe` on Windows, `backend/venv/bin/python` on macOS/Linux. All commands run from the repo root. Never use bare `python`, `py`, `pip`, or `ruff`.

Run the steps independently. A failing step does not cancel the others.

## 1. Frontend lint

```powershell
npm --prefix frontend run lint
```

This lints the whole frontend by design, including files you did not change.

## 2. Frontend type-check

```powershell
npx --prefix frontend tsc --noEmit -p frontend
```

Test files are excluded by `frontend/tsconfig.json`.

## 3. Frontend tests

```powershell
npm --prefix frontend test
```

Report passed, failed, and skipped counts. Never run `npm run test:watch`.

## 4. Backend Ruff (changed files only)

List every changed or new path under `backend/`, including every file inside a new folder:

```powershell
git status --short -uall -- backend
```

From that output:

1. Keep only `.py` paths.
2. Skip deleted entries (status ` D` or `D `), since there is nothing to lint.
3. The path is the last token on each status line, so strip the 2-character status prefix plus the space, for example ` M backend/events/views.py` becomes `backend/events/views.py`.
4. For a rename, `status --short` prints `old -> new`, so lint the new path.
5. Drop anything under `backend/venv/` or `backend/**/migrations/`; `--force-exclude` applies the same exclusions for you.

Then lint the collected paths. `--force-exclude` makes Ruff honour `backend/ruff.toml` exclusions even when a path is passed explicitly, which matters because the paths are passed directly rather than discovered by Ruff. The command below uses example paths only; substitute the paths you collected:

```powershell
<py> -m ruff check --force-exclude backend/events/views.py backend/partners/models.py
```

When the list is empty, skip the step and report it as SKIPPED. Do not lint all of `backend/`.

## 5. Backend tests

```powershell
<py> -m pytest backend
```

`backend/pytest.ini` forces `config.settings.test` (in-memory SQLite), so the shared Postgres is not touched.

## 6. Django check

```powershell
<py> backend/manage.py check
```

## 7. Migrations up to date

```powershell
<py> backend/manage.py makemigrations --check --dry-run
```

A non-zero exit means a model change has no migration.

## Report

| Check | Status |
|---|---|
| Frontend lint | PASS / FAIL |
| Frontend type-check | PASS / FAIL |
| Frontend tests | PASS / FAIL (N passed, M failed) |
| Backend Ruff (changed files) | PASS / FAIL, or SKIPPED (no changed files) |
| Backend tests | PASS / FAIL (N passed, M failed) |
| Django check | PASS / FAIL |
| Migrations up to date | PASS / FAIL |

List the concrete errors under each FAIL. Do not paraphrase a Django system check warning as a failure without quoting it. Do not offer to apply fixes unless asked.
