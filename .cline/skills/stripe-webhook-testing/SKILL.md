---
name: stripe-webhook-testing
description: Test or debug the Stripe donation webhook (/api/payments/webhook/) locally in the msscc sandbox. Use when verifying payment status updates, reproducing a webhook bug, or checking how StripeWebhookView handles an event. Test mode only; never reads .env files or card data.
---

# Stripe webhook testing

`<py>` means the backend venv interpreter: `backend\venv\Scripts\python.exe` on Windows, `backend/venv/bin/python` on macOS/Linux. Never use bare `python`, `py`, `pip`, or `ruff`.

## Ground rules
- Test mode only, in the shared "msscc sandbox" Stripe account. Every key, session, and event must be a test object (`sk_test_`, `pk_test_`, `cs_test_`, `evt_` from the sandbox). If anything suggests live mode, stop and tell the human.
- Never read, print, or edit `.env` files. The running Django server already has `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` loaded; rely on that. If a key seems missing, tell the human which variable name to check (see `backend/.env.example`).
- Never handle card numbers in code, logs, or fixtures. Card entry happens only in the Stripe Elements form in the browser.
- Do not run `stripe login`, `stripe listen`, or `runserver`. The human runs long-running and credential commands in their own terminal. `stripe trigger` and test runs need approval.
- The dev database is shared. Events change real rows that teammates can see. Use donations you created for the test.

## How the handler works (read before testing)
Code: `backend/payments/views.py` (`StripeWebhookView`, `_get_payment_status`, `_get_internal_reference`, `_update_donation_payment_status`). Route: `POST /api/payments/webhook/`.

| Input | Expected response | Database effect |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` not set | 503 | none |
| Missing `Stripe-Signature` header | 400 | none |
| Bad payload or bad signature | 400 | none |
| Unsupported event type | 200 `{"received": true}` | none |
| Supported event without a `DON-` reference | 200 | none (logged warning) |
| Reference with no matching donation | 200 | none (logged warning) |
| `checkout.session.completed` with `payment_status` other than `paid` | 200 | stays pending |
| Supported event, matching donation | 200 | `payment_status` updated |
| A completed donation receives a failure or expiry | 200 | stays completed |
| Same event delivered twice | 200 | no second write |
| Database error | 503 (Stripe retries) | none |

Supported events: `checkout.session.completed` (paid only), `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`.

The reference comes from `client_reference_id` on Checkout Sessions, or `metadata.internal_reference` on PaymentIntents. Donation references look like `DON-00000042` (`backend/donations/serializers.py`).

## Steps

1. **Human starts the stack.** Ask the human to run, in separate terminals:
   ```powershell
   # from repo root, backend venv interpreter
   <py> backend/manage.py runserver
   # frontend/
   npm run dev
   # any folder
   stripe listen --forward-to localhost:8000/api/payments/webhook/
   ```
   The team shares one signing secret, already in everyone's `.env`. If `stripe listen` prints a different `whsec_` value, the human (not Cline) updates `.env` and restarts `runserver`.

2. **End-to-end test (preferred).** Ask the human to make a donation on the public support page (`http://localhost:3000/en/support`) and pay with Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC. Expected:
   - `stripe listen` shows `checkout.session.completed` and `payment_intent.succeeded` forwarded with `[200]`.
   - The payment-return page shows the completed status.
   - `GET /api/payments/status/?session_id=cs_test_...` returns `{"payment_status": "completed"}`.
   For failures, use Stripe's documented decline test cards and expect `failed`.

3. **Targeted event (with approval).** A plain `stripe trigger` has no `DON-` reference, so it returns 200 and changes nothing. That only proves signature checking works. To exercise a status change, attach the reference of a pending donation you created:
   ```powershell
   stripe trigger payment_intent.payment_failed --override payment_intent:metadata.internal_reference=DON-00000042
   ```
   Confirm the flag syntax with `stripe trigger --help` before running. Check the result through the status endpoint or the admin donations page, not by querying the database directly.

4. **Report.** Summarize each event: type, HTTP status from `stripe listen`, expected vs. actual donation status. Do not paste full event payloads; they contain donor names and emails.

## Notes
- Teammates' `stripe listen` sessions receive the same sandbox events. Duplicate deliveries are expected and handled idempotently.
- Unit tests for this handler live in `backend/payments/tests.py`. Run them from the repo root with `<py> -m pytest backend/payments`; `backend/pytest.ini` locks test settings to in-memory SQLite, so the shared Postgres is untouched.
- Do not change webhook code as part of a test task. If a test reveals a bug, describe it and propose a fix separately.
