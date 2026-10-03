# Testing conventions

Source: `docs/coding-style-guide.md`, section 2 (backend) and section 3 (frontend).

## Test locations and naming
- Backend: `backend/<app>/tests.py`, or `test_<topic>.py` when one file gets too large. Classes are `<Thing>Tests`, methods are `test_<behavior>`.
- Frontend: `<SourceName>.test.ts` or `<SourceName>.test.tsx`, colocated next to the source file, never in a top-level `__tests__` directory.
- Frontend tests run in the Node environment (`frontend/jest.config.js` sets `testEnvironment: 'node'`), so keep pure logic in `frontend/utils/` where it can be tested without a DOM.

## When to add tests
- Add tests for the new or changed behavior the story calls for.
- Add a regression test for a bug fix when practical.
- Do not edit an existing test just to make it pass. If a test looks wrong, say so and ask.
- Do not write tests for unrelated code.

## Backend patterns
- Test classes subclass `django.test.TestCase`, imported from `django.test`, and carry a one-line docstring (`docs/coding-style-guide.md`, section 2).
- Required fields: assert with `full_clean()` and inspect `message_dict`, not `IntegrityError` (`docs/coding-style-guide.md`, section 2). Django stores an omitted `TextField` as `""`, and `blank=False` is enforced by `full_clean()` and serializers, not the database, so `objects.create()` raises nothing. See `backend/admin_support/tests.py` for the pattern.
- API tests authenticate with `self.client.force_authenticate(user=self.user)` and use `self.client` (`docs/coding-style-guide.md`, section 2; `backend/events/tests.py`).
- The team's de facto convenience pattern is a `create_<model>(**overrides)` helper under the test class, so each test varies one field (`backend/donations/tests.py`, `backend/payments/tests.py`). Not required, but follow it in the app you are working in.
- Some view internals are tested with `rest_framework.test.APIRequestFactory` instead of a live server (`backend/donations/tests.py`, `backend/payments/tests.py`). Use it for unit-style view tests; use `self.client` for endpoint tests.
- `backend/config/settings/test.py` uses in-memory SQLite and dummy service keys. Never point a test at the shared Postgres and never read `.env` or any secret file.

## Frontend patterns
- Mock `fetch` and other network calls. Never hit a live service, real Stripe, or DeepL from a test.

## Running tests
- Backend, from the repo root: `<py> -m pytest backend`. A single app, file, class, or method works too, for example `<py> -m pytest backend/events/tests.py::EventListAPITests`.
- Frontend, from the repo root: `npm --prefix frontend test`. Never `npm run test:watch` (it never exits).
- Both commands are read-only in `.clinerules/security.md`, so no approval is needed. `manage.py test` is not: it uses dev settings and would create a test database on the shared Postgres.
