# Project context

## What this is
Bilingual (English/Japanese) website and admin portal for the Matsuyama-Sacramento Sister City Corporation (MSSCC), a non-profit. Built by the SCRUM Lords CSUS senior project team. Product Owner: Bryan Fisher. CTO: Robert Martinez. Delivery: December 2026.

## Stack (as installed, not as planned)
- Frontend `frontend/`: Next.js 14.2 (App Router), React 18, TypeScript (strict), Tailwind CSS 3, next-intl 4, react-hook-form + zod, Stripe Elements. Node 22 (`frontend/.nvmrc`).
- Backend `backend/`: Django 6.0, Django REST Framework, SimpleJWT, Python 3.12. Settings in `backend/config/settings/` (`base.py`, `development.py`, `production.py`).
- Data: PostgreSQL (shared team dev DB; Railway in production). Media: MinIO in dev, Cloudflare R2 in production, via django-storages with path-style addressing.
- Services: Stripe (payments), Resend (email), DeepL (translation, called from `frontend/app/api/translate/route.ts`).

## Repo map
- `frontend/app/[locale]/` public pages (localized `en`/`ja`); `frontend/app/admin/` admin portal (not localized).
- `frontend/messages/en.json`, `ja.json` UI strings. `frontend/services/` API calls. `frontend/types/` shared types.
- `backend/<app>/` one Django app per domain: `accounts`, `events`, `donations`, `payments`, `content`, `page`, `media`, `partners`, `board_members`, `volunteer_signup`, `volunteer_slots`, `emails`, `admin_support`, `static_image`, `translations`.
- `docs/` setup guide and dev git hooks.
- All accounts are admin accounts (`accounts.AdminUser`). There is no public user login.

## How to work in this repo
- Start from the Jira subtask and its acceptance criteria. If either is missing or unclear, ask before planning.
- For multi-file changes, propose a plan (files to touch, approach, risks) and wait for approval before editing.
- Change only what the task needs. Do not reformat, rename, or reorder untouched code. Never regenerate a whole file for a small change.
- Do not add, remove, or upgrade dependencies without asking first.
- Do not change behavior while doing cleanup or lint work. If a fix would change behavior, flag it instead.
- Most of the team uses Windows. Give PowerShell commands, or both PowerShell and bash when they differ.
- Run the read-only checks in `security.md` after editing and report the results.
- The backend virtual environment already exists at `backend/venv/`. Do not look for it, create one, or try to activate it. Run every Python command through its interpreter:
  - Windows: `backend\venv\Scripts\python.exe`
  - macOS/Linux: `backend/venv/bin/python`
  - Examples from the repo root (Windows): `backend\venv\Scripts\python.exe -m ruff check backend`, and `backend\venv\Scripts\python.exe backend\manage.py check`.
  - Never use bare `python`, `py`, `pip`, or `ruff`. They point at the system Python, which does not have the project's packages.
  - If the interpreter path does not exist, stop and tell the human to follow the dev setup guide.
