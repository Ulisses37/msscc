# Documentation updates

## When to update the README or `docs/`
Update docs in the same change only when a reader would otherwise get stuck:
- A new feature changes how to set up, run, or use the project.
- A new or renamed environment variable. Also add it, without a value, to `backend/.env.example` or `frontend/.env.local.example`.
- A new dependency, service, command, or required install step (update `docs/MSSCC_Dev_Setup_Guide.md`).
- A new Django app, top-level folder, or route group (update the README repository structure).

Do not touch docs for bug fixes, refactors, lint cleanup, or styling changes.

## How to write them
- Edit only the affected section. Never rewrite or reorder a whole document.
- No em dashes. Use commas, colons, parentheses, or separate sentences.
- Commands work in PowerShell; add the bash version when it differs.
- Never include real secret values, hostnames, IPs, or credentials. Use placeholders like `<your-value>`.
- Markdown file names are lowercase with hyphens, except existing files.
