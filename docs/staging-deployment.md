# Staging deployment

Deploy the backend first, then the frontend. Use a separate staging database and
R2 bucket with synthetic data. Platform URLs are public; existing API permission
issues remain.

## 1. Railway backend and PostgreSQL

Create a PostgreSQL service and a backend service from this repository. Configure
these settings in the backend service dashboard:

| Setting | Value |
| --- | --- |
| Root directory | `/backend` |
| Builder | Railpack |
| Pre-deploy command | `python manage.py migrate --noinput` |
| Start command | `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --access-logfile - --error-logfile -` |
| Healthcheck path | `/health/` |

Python 3.12 is pinned in
`backend/.python-version`. The start command also appears in `backend/Procfile`.
Do not use `runserver` or connect this deployment to the shared development database.

Set these backend variables in Railway, never in committed files:

| Variable | Staging value or purpose |
| --- | --- |
| `DJANGO_SETTINGS_MODULE` | `config.settings.production` |
| `DJANGO_SECRET_KEY` | Independent secret, supplied securely |
| `FIELD_ENCRYPTION_KEYS` | Independent Fernet keyring, supplied securely |
| `DATABASE_URL` | Reference to the Railway PostgreSQL service's private `DATABASE_URL` |
| `DJANGO_ALLOWED_HOSTS` | Backend public hostname only, no scheme |
| `CORS_ALLOWED_ORIGINS` | Exact HTTPS Netlify site origin, no trailing slash |
| `FRONTEND_URL` | Same Netlify site origin |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | R2 credentials scoped to the staging bucket |
| `S3_BUCKET` | Staging bucket name |
| `S3_ENDPOINT_URL` | R2 S3 API endpoint, including HTTPS |
| `S3_REGION` | `auto` |
| `S3_PUBLIC_DOMAIN` | Public R2 delivery hostname only, no scheme or path |
| `STRIPE_ENABLED` | `false` |
| `EMAIL_ENABLED` | `false` |
| `EVENT_ANNOUNCEMENTS_ENABLED` | `false` |
| `MEMBERSHIP_REMINDERS_ENABLED` | `false` |

Reserve the Netlify site name before deploying the backend so its origin is known.
If the backend hostname is not assigned yet, generate its Railway public domain,
update `DJANGO_ALLOWED_HOSTS`, then redeploy. Do not use `*` for allowed hosts or CORS.
The Railway healthcheck hostname is allowed separately by the settings.

No Stripe or Resend keys are required while those services are disabled. Leave
`TRIGGER_API_KEY` unset and do not create reminder cron jobs for this deployment.
The scheduler endpoints reject requests while their secret is unset.

Enable public delivery for website media in the staging R2 bucket and configure
its delivery hostname, not its authenticated S3 API endpoint, as `S3_PUBLIC_DOMAIN`.
R2 object ACLs are disabled by hosted settings. Keep private documents out of this
public media bucket. Back up the field-encryption keys securely: losing them makes
encrypted financial data unreadable even if the database is restored.

### Initial account and content

After migrations succeed, use the Railway service's hosted terminal to run these
Linux-container commands manually. They write only to the staging database/bucket;
do not run them locally against hosted services:

```sh
python manage.py createsuperuser
python manage.py seed_pages
```

The custom user manager marks a superuser as an executive for the Next.js portal.
Django's built-in `/admin/` remains disabled. Additional staging accounts can also
be created manually while emailed invitations are unavailable.

The backend-only build excludes `frontend/assets` and `docs/pagecontent.docx`, which
some existing media/content seed commands expect. Do not run those commands with
their default paths in this build. Upload media and enter initial page content
through the custom portal instead.

## 2. Netlify frontend

Import the repository. The root `netlify.toml` sets the `frontend` base directory,
`npm run build`, `.next`, and Node 22. Keep Netlify's Next.js runtime enabled; do not
use static export or an SPA catch-all rewrite because DeepL uses Next.js API routes.

Set these variables in Netlify before building:

| Variable | Staging value or purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Railway HTTPS origin only, no `/api` suffix or trailing slash |
| `NEXT_PUBLIC_PAYMENTS_ENABLED` | `false` |
| `MEDIA_PUBLIC_HOST` | Same hostname as backend `S3_PUBLIC_DOMAIN`, available at build time |
| `DEEPL_API_KEY` | Server-only credential, available to Netlify Functions |

Leave `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` unset initially. Do not place Django,
database, R2, Stripe secret, or Resend credentials in frontend variables.

Use the stable Netlify site URL for this first deployment, not arbitrary deploy
preview origins. Rebuild after changing public variables or the media hostname.

## 3. Smoke checks

- Backend `/health/` returns 200 and `/admin/` returns 404.
- English and Japanese public pages load and refresh at deep links.
- Log into the custom portal with the staging executive account.
- Edit content, upload an image, and verify its public R2 URL and frontend display.
- Verify translation with the existing DeepL routes.
- Donation and membership pages show online payments as unavailable.
- Manual financial record entry remains available to authorized accounts.
- Password-reset requests and email invitations report unavailability, not success.
- Mailing-list signup reports failure while email is disabled; optional notification
  emails are skipped. Volunteer registrations still save, but no confirmation or
  cancellation-link email is delivered. Do not advertise email-dependent workflows.

Run lint, type checks, tests, and a frontend build before deployment. Take a database backup
before later migrations; reverting application code does not undo database changes.

## 4. Enable services later

Stripe: configure test-mode `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on Railway,
register `/api/payments/webhook/`, then set `STRIPE_ENABLED=true`. Set the matching
test-mode `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_PAYMENTS_ENABLED=true`
on Netlify and rebuild. Verify checkout and signed webhook processing in staging.
Email is independent and can remain disabled.

Resend: configure `RESEND_API_KEY`, a verified `RESEND_FROM_EMAIL`, and the existing
mailing-list segment/webhook settings as needed. Set `EMAIL_ENABLED=true` and verify
delivery before using invitations or password recovery. Enable announcements and
membership reminders separately only after verification. Configure a scheduler
secret before creating any reminder cron jobs.

For existing local setups, unset or blank service switches infer availability from
their configured API keys. Explicit `false` disables the service even with a key.