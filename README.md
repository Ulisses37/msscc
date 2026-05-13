![MSSCC Logo](./frontend/public/images/msscc-logo.png)

# MSSCC Website

A bilingual (English/Japanese) website for the [Matsuyama-Sacramento Sister City Corporation](https://msscc1.org), replacing their existing Squarespace site. Built by **SCRUM Lords** as a CSUS Computer Science Senior Project (Spring 2026 to Fall 2026).

---

## Project Status

> **In active development.** Sprint 4 complete. Public site and admin portal are partially implemented. Expected delivery: December 2026.

---

## Overview

The project delivers two surfaces:

- **Public site:** informational pages (Home, Events, About, Partners, Donations, Membership, Volunteer), bilingual EN/JP toggle, and Stripe-powered payment processing
- **Admin portal:** event management, member records, donation history, content editing with automatic DeepL translation, and role-based account permissions

---

## Prerequisites

- Python 3.12
- Node.js 22 LTS
- PostgreSQL 16
- Docker (for local dev stack)

## Documentation

Full setup and onboarding guides live in the [`docs/`](./docs) directory:

- [Local Development and Testing Setup](./docs/MSSCC_Dev_Setup_Guide.md)
- [Database Schema (ERD)](./docs/erd.mmd)
- Deployment Guide (To be added next semester)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Django 5.1, Django REST Framework, SimpleJWT |
| Database | PostgreSQL |
| Storage | Cloudflare R2 (prod) / MinIO (dev) |
| Payments | Stripe |
| Email | Resend |
| Translation | DeepL API |
| Frontend hosting | Netlify |
| Backend hosting | Railway |

---

## Repository Structure

```
msscc/
├── frontend/          # Next.js 14 app
│   ├── app/           # App router pages
│   ├── components/    # UI, layout, auth, admin, events, partners
│   ├── context/       # AuthContext
│   ├── services/      # API service layer
│   ├── types/         # TypeScript types
│   └── config/        # Shared config
└── backend/           # Django project
    ├── accounts/      # Auth app (JWT)
    └── ...
```

---

## Why

MSSCC was paying ~\$40/month for Squarespace, a general-purpose site builder with no bilingual support, no admin portal, and no payment integration suited to a non-profit. The replacement stack is expected to run **\~\$6–13/month** in fixed costs (Railway for backend/DB, Cloudflare R2 for storage), with Stripe fees incurred only on actual transactions and no monthly platform fee.

Beyond cost, the stack was chosen to match the project's specific requirements:

- **Next.js + Django:** clean separation between a fast, statically-renderable public site and a structured REST API backend, with JWT auth as the handoff point
- **PostgreSQL:** stores both English and Japanese content side-by-side, enabling the translation workflow without a separate i18n service at runtime
- **Cloudflare R2:** S3-compatible object storage with no egress fees, keeping image hosting costs near zero regardless of traffic
- **DeepL API:** used only when admins publish content edits; translations are cached in the database, so the free tier's 500k character/month limit is more than sufficient
- **Stripe:** explicit non-profit support with a discounted processing rate (~2.2% + $0.30) available to MSSCC upon verification
- **Netlify + Railway:** both offer simple Git-based deploys appropriate for a student team handing off to a non-technical organization

---

## Timeline

The following milestones represent the remaining work through December 2026 delivery.

### Phase 1: Public Site Parity

Reach feature parity with the existing Squarespace site. All public-facing pages live (Home, Events, About, Partners, Volunteer), bilingual EN/JP toggle functional, and donations and membership payment processing through Stripe fully tested and operational.

### Phase 2: Admin Portal

Administrative features beyond the current Squarespace site. Includes event creation and management, member records, donation history, content editing with DeepL translation workflow, and role-based account permissions for admin users.

### Phase 3: Production Cutover

Environment swap from development services to live accounts (Cloudflare R2, Railway, Netlify), domain configuration, end-to-end testing, and stakeholder handoff to Bryan Fisher and Robert Martinez.

---

## Team

**SCRUM Lords** | CSUS Computer Science, Senior Project Spring-Fall 2026

Gina Kim · Ulisses Arredondo · Lucas Bilyk · Keav'n Lor · Sang Nguyen · David Nam · Cole Tanner

**Product Owner:** Bryan Fisher, President, Matsuyama-Sacramento Sister City Corporation  
**CTO:** Robert Martinez

---

## License

Source code and documentation are delivered to MSSCC upon project completion per the terms of the CSUS Senior Project agreement. The CSUS Computer Science Department reserves the right to use project materials as examples of student work.
