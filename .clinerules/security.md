# Security and command approval

## Secrets
- Never read, print, create, copy, or edit `.env`, `.env.local`, or any other env file except for the example files, `backend/.env.example` and `frontend/.env.local.example` for variable names only.
- Never print, log, or echo secret values (`*_SECRET_KEY`, `*_API_KEY`, `*_PASSWORD`, `STRIPE_WEBHOOK_SECRET`, `S3_*` credentials). Do not run `manage.py shell` or scripts that would print settings values.
- Never hardcode a secret, token, password, or connection string in code, tests, docs, or commit messages. Read config with `os.environ` / `os.getenv` (backend) or `process.env` (frontend).
- New env vars: add the name with an empty or placeholder value to the matching `.env.example` file. The human fills in real values.
- Server-only keys (`DEEPL_API_KEY`, Stripe secret key) must never get a `NEXT_PUBLIC_` prefix or reach client components.
- Card data never touches our code. Payments go through Stripe Checkout/Elements only.
- Stripe work is test mode only (`sk_test_`, `pk_test_`, `cs_test_`). Stop and ask if anything looks like a live key or live object.

## Command approval
Set `requires_approval=false` ONLY for these read-only checks, run exactly as written, from the repo root.

`<py>` means the backend venv interpreter: `backend\venv\Scripts\python.exe` on Windows, `backend/venv/bin/python` on macOS/Linux. Never use bare `python`, `py`, `pip`, or `ruff`.

- Frontend: `npm --prefix frontend run lint`, `npx --prefix frontend tsc --noEmit -p frontend`
- Backend lint: `<py> -m ruff check backend`, `<py> -m ruff check --force-exclude <paths under backend/>`
- Django: `<py> backend/manage.py check`, `<py> backend/manage.py makemigrations --check --dry-run`, `<py> backend/manage.py showmigrations`
- Git: `git status`, `git diff`, `git log`, `git branch`, `git show`
- Frontend tests: `npm --prefix frontend test`
- Backend tests: `<py> -m pytest backend` (optional path under `backend/`)

Set `requires_approval=true` for everything else, including:
- Any command with `--fix`, `--write`, or that formats files (`ruff format` without `--check`)
- `npm install`, `npm ci`, `npm uninstall`, `pip install`, `pip uninstall`
- `<py> backend/manage.py migrate`, `makemigrations` (without `--check`), `test`, `shell`, `dbshell`, `flush`, `createsuperuser`, `loaddata`
  `test` is named on purpose: it uses dev settings and would create a test database on the shared Postgres.
- `npm run test:watch` (never exits)
- Any git command that changes state: `add`, `commit`, `push`, `pull`, `checkout`, `switch`, `reset`, `rebase`, `merge`, `stash`, `clean`
- `stripe` CLI commands, `docker`, `mc`, `curl`, `Invoke-WebRequest`, `rm`, `del`, `Remove-Item`, `mv`, `Move-Item`
- Chained commands (`&&`, `;`, `|`) unless every part is on the read-only list

When a check reports problems, propose the fix as a file edit. Run an auto-fix command only when the human explicitly asks, and always with approval.

## Shared infrastructure
- The dev PostgreSQL database and MinIO bucket are shared by the whole team. Anything that writes to them affects all seven developers. Explain the impact and wait for approval first.
- Never target production (Railway, R2, Netlify) from a dev machine.
