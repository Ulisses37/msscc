# Membership expiry reminders

Sends a reminder email to members whose membership expires within 14 days, so
they can renew without a lapse.

## What it sends

An English transactional email (`emails/membership_expiry_reminder.html`) that
names the expiry date and links to `<FRONTEND_URL>/en/membership`. It is an
account notice, not marketing, so it carries **no unsubscribe link** and goes to
members regardless of their mailing-list status. This choice needs Product Owner
confirmation and is recorded in the Story D PR.

## The command

```powershell
backend\venv\Scripts\python.exe backend\manage.py send_membership_expiry_reminders
```

```bash
backend/venv/bin/python backend/manage.py send_membership_expiry_reminders
```

| Option | Default | Meaning |
|---|---|---|
| `--days-before` | `14` | Remind members expiring within this many days. |
| `--limit` | `50` | Maximum reminders to attempt in one run. |
| `--dry-run` | off | Report who would be reminded, without claiming or sending. |

Running it twice in a day sends one email per member: the expiry date is claimed
before the send, so a second run finds the claim taken and skips those members.

A member is selected when their `end_date` is inside the window, they have a
usable address, their `status` is not one of `inactive`, `canceled`, `cancelled`,
`expired` or `pending`, their `payment_status` is not `failed` or `canceled`, and
they have not already been reminded for that expiry. Members with no `end_date`
are never selected, which is how lifetime and historical memberships are left
alone.

## First run: review with a dry run

The dry run reports the members that would be reminded and sends nothing, so the
list can be checked before the feature is switched on. It deliberately ignores
`MEMBERSHIP_REMINDERS_ENABLED`, so it works while the feature is still off.

```powershell
backend\venv\Scripts\python.exe backend\manage.py send_membership_expiry_reminders --dry-run
```

Review the listed membership primary keys for:

- **Lifetime or historical members who carry an `end_date`.** They are normally
  excluded because a lifetime record has no expiry date, but an imported row may
  have one by mistake, and those members should not be asked to renew.
- **Members who have already renewed manually.** If a second term was recorded as
  a separate row, the newer expiry supersedes the older one and only the current
  term is reminded. Rows with a blank or differently formatted address are not
  matched, so check for those by hand.

The dry run reports primary keys only, never addresses.

## Enabling it

`MEMBERSHIP_REMINDERS_ENABLED` must be `true` for a real run. It defaults to off,
because there is no verified Resend sending domain yet. Set it in the environment
that runs the scheduler, not in a committed file.

## Scheduling

There is no worker or scheduler in this stack, so an external scheduler POSTs to
a protected endpoint that runs the same command.

**Railway cron service**

| Setting | Value |
|---|---|
| Schedule | `0 17 * * *` (daily at 17:00 UTC) |
| Method | `POST` |
| URL | `https://<your-backend-host>/api/trigger/membership-reminders/` |
| Header | `X-API-Key: <TRIGGER_API_KEY>` |

**Why 17:00 UTC.** The selector compares dates against `TIME_ZONE`, which is
`UTC`. Pacific midnight falls at 07:00 or 08:00 UTC depending on daylight saving,
so the UTC date is ahead of the Pacific date only *before* that hour. A run at
17:00 UTC is safely the same Pacific date, so a member is never reminded a day
early or a day late at the boundary.

The endpoint returns the run tally as JSON, so a cron that sent nothing is
distinguishable from a healthy run:

```json
{"sent": 4, "skipped": 1, "failed": 0, "limit": 50,
 "limit_reached": false, "disabled": false, "aborted": false, "would_remind": []}
```

- `disabled: true` means the feature flag is off and nothing was sent.
- `aborted: true` means repeated provider failures ended the run early; the
  claims were released and the next run retries.
- `limit_reached: true` means more eligible members remained than `--limit`
  allowed; raise the limit or run again.

## Provider limits and risks

- **Unverified sending domain.** Live delivery has never been confirmed from this
  account, so the first enabled run must be watched. Tests mock the provider.
- **Resend free tier allows about 100 emails a day**, shared with receipts and
  event announcements. The default `--limit 50` keeps one run under that cap.
- **At most once per expiry.** The claim is taken before the send, so a crash
  between the two skips that member until the next cycle. No member is ever
  emailed twice for the same expiry.
- **Best effort under concurrent runs.** Two runs that overlap can select
  different rows for one address and claim each separately. Run the schedule
  once, not on two schedulers at once.
- **One reminder per address per expiry.** Members who share an address are
  treated as one member.

## Launch checklist

Do these in order, on the target environment. Nothing here is automated: the
deploy applies no migrations and creates no cron job.

1. **Apply migration `0022` before or with the deploy.** The reminder writes
   `Membership.expiry_reminder_for`, so the column must exist before the endpoint
   can run. The repo has no `release` step, no `Dockerfile` and no `railway.json`,
   and CI only checks that migrations exist, so this is a manual step on the
   Railway shell or from an approved deploy run:

   ```powershell
   python backend/manage.py migrate donations
   ```

2. **Set `TRIGGER_API_KEY` in production.** A real value, not the `dev-trigger-key`
   default. The endpoint returns 403 without it. Use the same value on the cron
   job's request header.

3. **Create the Railway cron job.** Daily at `0 17 * * *`, `POST` to
   `https://<your-backend-host>/api/trigger/membership-reminders/` with the
   `X-API-Key` header. The schedule is configured in the Railway dashboard, not
   in this repository.

4. **Run a dry run and review the list.** The dry run ignores the feature flag, so
   it works before step 5. Run it from the Railway shell and check the printed
   membership primary keys for lifetime or historical members carrying an
   `end_date`:

   ```powershell
   python backend/manage.py send_membership_expiry_reminders --dry-run
   ```

5. **Set `MEMBERSHIP_REMINDERS_ENABLED=true`** and restart the backend. The first
   real run is the first live send, so watch the log and the tally for
   `failed` or `aborted`.

If a run goes wrong, set `MEMBERSHIP_REMINDERS_ENABLED=false` and pause the cron
job. Members already reminded for their expiry are not emailed again, so a resume
does not duplicate.
