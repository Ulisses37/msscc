# Security and command approval

## Secrets
- Never read, print, create, copy, or edit `.env`, `.env.local`, or any other env file. Use `backend/.env.example` and `frontend/.env.local.example` for variable names only.
- Never print, log, or echo secret values (`*_SECRET_KEY`, `*_API_KEY`, `*_PASSWORD`, `STRIPE_WEBHOOK_SECRET`, `S3_*` credentials). Do not run `manage.py shell` or scripts that would print settings values.
- Never hardcode a secret, token, password, or connection string in code, tests, docs, or commit messages. Read config with `os.environ` / `os.getenv` (backend) or `process.env` (frontend).
- New env vars: add the name with an empty or placeholder value to the matching `.env.example` file. The human fills in real values.
- Server-only keys (`DEEPL_API_KEY`, Stripe secret key) must never get a `NEXT_PUBLIC_` prefix or reach client components.
- Card data never touches our code. Payments go through Stripe Checkout/Elements only.
- Stripe work is test mode only (`sk_test_`, `pk_test_`, `cs_test_`). Stop and ask if anything looks like a live key or live object.

## Command approval
Set `requires_approval=false` ONLY for these read-only checks, run exactly as written:
- Frontend (in `frontend/`): `npm run lint`, `npx tsc --noEmit`
- Backend lint (from repo root): `ruff check backend`, `ruff format --check backend`
- Django (in `backend/`, venv active): `python manage.py check`, `python manage.py makemigrations --check --dry-run`, `python manage.py showmigrations`
- Git: `git status`, `git diff`, `git log`, `git branch`, `git show`

Set `requires_approval=true` for everything else, including:
- Any command with `--fix`, `--write`, or that formats files (`ruff format` without `--check`)
- `npm install`, `npm ci`, `npm uninstall`, `pip install`, `pip uninstall`
- `python manage.py migrate`, `makemigrations` (without `--check`), `test`, `shell`, `dbshell`, `flush`, `createsuperuser`, `loaddata`
- Any git command that changes state: `add`, `commit`, `push`, `pull`, `checkout`, `switch`, `reset`, `rebase`, `merge`, `stash`, `clean`
- `stripe` CLI commands, `docker`, `mc`, `curl`, `Invoke-WebRequest`, `rm`, `del`, `Remove-Item`, `mv`, `Move-Item`
- Chained commands (`&&`, `;`, `|`) unless every part is on the read-only list

When a check reports problems, propose the fix as a file edit. Run an auto-fix command only when the human explicitly asks, and always with approval.

## Shared infrastructure
- The dev PostgreSQL database and MinIO bucket are shared by the whole team. Anything that writes to them affects all seven developers. Explain the impact and wait for approval first.
- Never target production (Railway, R2, Netlify) from a dev machine.
