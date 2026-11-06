# Donation CSV import (SCRUM-843)

This guide is tracked in Git for admins and testers. The donation admin page
provides a template download and a summary of the rules. The ordered contract
in `backend/donations/donation_csv_contract.py` generates the actual CSV; neither
the download nor the page instructions are seeded database content. The
existing configurable CSV/XLSX donation exports are **not** import templates.

## Availability and safe testing

- **SCRUM-881 provides the template download only.** Upload, read-only review,
  duplicate warnings, confirmation, and batch results are planned for later
  subtasks. The existing Add donation form creates one record, not a CSV batch.
- Run a frontend and backend version that both include the donation template
  endpoint. Sign in as an active executive admin or an active admin with
  `Finances` access. The download endpoint independently checks permission;
  anonymous, inactive, and unprivileged accounts cannot download it.
- The template has no donor details. Use only fictional data in test systems.
  Downloading it does not write financial records or require a new migration.
  Do not use production data or apply migrations to a shared development
  database without coordinating with the team.

## Fixed donation CSV contract

Choose **Download donation CSV template** on Admin > Donations. The downloaded
`donation-import-template.csv` contains **one header row and no example donors**.
Keep these ten columns in this exact order; each subsequent data row represents
one already-received offline or historical donation:

```text
amount,donation_date,is_anonymous,payment_method,donor_first_name,donor_last_name,donor_email,address,external_reference,message
```

| Field | Required | Allowed input and meaning |
| --- | --- | --- |
| `amount` | Yes | Known, positive USD decimal from `0.01` through `99999999.99`, with at most two decimal places. No currency symbol, thousands separator, sign, or exponent. Blank and zero are invalid. |
| `donation_date` | Yes | Known calendar date in `YYYY-MM-DD` format, no later than the date of recording. Never substitute today's date for an unknown historical date. |
| `is_anonymous` | Yes | Exactly `true` or `false` (lowercase). Blank or another spelling is not a valid unknown value. |
| `payment_method` | No | `cash`, `check`, or blank if the historical method is unknown. Do not guess from an external reference. |
| `donor_first_name`, `donor_last_name` | No | Historical names, or blank if unknown. Both must be blank when `is_anonymous` is `true`. |
| `donor_email` | No | A valid email, or blank if unknown. An anonymous donation may retain an optional email internally. |
| `address` | No | Historical address, or blank if unknown. Must be blank when `is_anonymous` is `true`. |
| `external_reference`, `message` | No | Historical reference/note, or blank. Neither controls the generated database reference. |

Blank optional contact fields mean **unknown**, not anonymous; a
non-anonymous donation can have no known contact details. Anonymous records
retain no donor names or address. Do not place identifying names or address in
anonymous rows, including in free-text notes.

These are **received** donations. Their status is server-set to `completed`,
and currency is USD. Neither is a CSV column. The importer does not charge a
card, calculate current online processing fees, send a receipt, or enroll a
donor in a mailing list. The template also excludes database IDs, record
origin, Stripe/checkout identifiers, and mailing-list consent.

Use UTF-8 CSV with the downloaded header, at most **1,048,576 bytes** and
**500 data rows**. Cell character limits: `amount` 11; `donation_date` 10;
`is_anonymous` 5; `payment_method` 20; each donor name 255; `donor_email`
254; `address` 500; `external_reference` 255; `message` 500. Preserve all
columns, even when optional cells are blank. These are the contracted limits
for the upload validation planned in SCRUM-882, not a claim that upload is
already available in SCRUM-881.

## Planned workflow after later subtasks

Once the remaining donation-import subtasks are delivered, the intended flow
is: fill the fixed template, upload it for backend-validated read-only review,
correct any errors in the source CSV and re-upload, review possible duplicate
warnings and acknowledge them explicitly, then confirm the whole batch or
none. A matching email alone will not prove that two donations are duplicates.
Results will identify the batch and offer access to its saved donations, even
if the current list search hides them. A lost confirmation response must be
resolved by a safe retry or authorized batch lookup, not by assuming no rows
were saved. **None of these upload, review, or save controls exists yet at the
SCRUM-881 checkpoint.**