# MSSCC Coding Style Guide

SCRUM Lords, CSUS Senior Project, 2026

This guide describes how we write code in this repo today. It replaces the earlier PDF guide.

Every rule is in one of two groups:

- **Enforced:** a tool checks it. The commit hook or `npm run lint` fails if you break it.
- **Expected:** nothing checks it. Follow it in code you write or edit, and reviewers may ask for it.

Two ground rules apply everywhere:

- Existing code that breaks an **Expected** rule stays as it is until someone edits it for another reason. Do not open cleanup-only changes for it.
- Do not reformat, requote, or reorder lines you are not otherwise changing. It makes diffs hard to review and causes merge conflicts. The exception is Ruff's auto-fix in the pre-commit hook. It may touch other lines in a file you edited. That is expected. Keep those changes in the same commit.

## 1. All files

Enforced by `.editorconfig` (your editor applies it) and by Ruff for Python:

- Spaces, never tabs. 4 spaces in Python, 2 everywhere else.
- No trailing whitespace. Every file ends with one newline.
- UTF-8 without a BOM. LF line endings.
- 100 characters per line at most.

Expected:

- Documentation files use lowercase names with hyphens (`coding-style-guide.md`).
- No em dashes in documentation. Use commas, colons, parentheses, or separate sentences.
- Never commit secrets. Config comes from environment variables, and new variable names go in the matching `.env.example` file with no value.

## 2. Python and Django (`backend/`)

The lint rules live in `backend/ruff.toml`. That file is the source of truth; this section explains it.

### Enforced by Ruff

Run `ruff check backend` from the repo root. Migrations are excluded.

| What | Ruff rules |
|---|---|
| Line length of 100, no trailing whitespace, final newline | `E`, `W` |
| No unused imports or variables, no undefined names | `F` |
| No wildcard imports. The one exception is `from .base import *  # noqa: F403` in the settings files | `F` |
| No bare `except:` | `E` |
| Imports sorted into four groups, with one blank line between: standard library, third-party (Django and DRF included), our own apps, and relative same-app imports | `I` |
| `snake_case` functions and variables, `PascalCase` classes, `UPPER_SNAKE_CASE` constants | `N` |
| Python 3.12 syntax, for example `X | None` instead of `Optional[X]` | `UP` |
| Common bug patterns, such as mutable default arguments | `B` |
| Every model defines `__str__`. Model members go in this order: fields, `class Meta`, `__str__`, `save`/`clean`, properties, other methods | `DJ` |
| No `print()`. Use `logging.getLogger(__name__)` | `T20` |

`ruff check <the files you changed> --fix` sorts imports and fixes whitespace for you.

One Django rule is turned off on purpose. `DJ001` forbids `null=True` on string fields. We allow it, because null ("never provided") and an empty string ("provided as blank") can mean different things.

### Expected

**Formatting**
- Double quotes for strings in new code.
- Two blank lines before top-level classes and functions, one between methods.
- `ruff format` is not enforced yet. Do not run it on whole files: it rewrites about half the backend. A one-time reformat may happen later as a single announced commit.

**Imports**
- Absolute imports across apps (`from events.models import Event`). `from .models import X` is fine inside an app. Never `..`.

**Naming**
- Models are singular (`Event`, `Donation`). Apps are short `snake_case`.
- Bilingual fields come in pairs with `_en` and `_ja` suffixes (`title_en`, `title_ja`).
- URL strings are lowercase kebab-case (`"board-members/"`).

**Views**
- Use DRF class-based views (`APIView`, generics, or ViewSets) for resources. `@api_view` is fine for one-off endpoints.
- Set `permission_classes` on every view. We have no project-wide default, so a view without it is open to anyone, logged in or not.
- Never return raw exception text, Stripe errors, or internal IDs to the client. Log the detail and return a plain message.

**Serializers**
- List `fields` explicitly. Do not use `fields = "__all__"`: it exposes every column, including ones added later.
- Put server-controlled fields in `read_only_fields`.

**Models and migrations**
- A model change and its migration go in the same story.
- The dev database is shared. Announce in Discord before running `migrate`.

**Docstrings and type hints**
- Public classes and functions get a docstring. One line is enough when the name says most of it. No module docstrings.
- Type hints are encouraged on new functions, mainly services and helpers. They are not required.

**Errors**
- Catch the specific exception you expect. Do not swallow an exception with `pass` unless a comment says why.

**Comments**
- Explain why, not what. Do not restate the code.
- `# TODO(name): ...` for follow-ups. Delete commented-out code; git history keeps it.

**Settings**
- Settings are split into `base.py`, `development.py`, and `production.py`.
- Read values with `os.environ` or `os.getenv`. Required secrets have no default, so a missing one fails at startup.

**Tests**
- Tests live in each app's `tests.py`, or in `test_<topic>.py` files when one file gets too long.
- Classes are named `<Thing>Tests`. Methods are named `test_<behavior>`.

## 3. TypeScript and Next.js (`frontend/`)

### Enforced by ESLint

Run `npm run lint` in `frontend/`. It uses Next's `core-web-vitals` and `typescript` rule sets. The ones you will meet most:

- No `any`. Use a real type, or `unknown` and narrow it.
- No unused variables or imports.
- Hooks follow the rules of hooks.
- Use `next/link` instead of a raw `<a>` for internal routes.

Two more show up as warnings. They do not fail the run, but fix them in code you touch:

- `useEffect` lists every dependency it uses.
- Use `next/image` instead of a raw `<img>`.

TypeScript runs in `strict` mode. `npx tsc --noEmit` should be clean for files you touch.

### Expected

**Formatting**
- 2-space indent. Semicolons. Trailing commas in multiline lists.
- Single quotes for strings and imports. Double quotes for JSX attributes.
- Prettier is not installed. Do not add it without a team decision.

**Files and folders**
- Components are `PascalCase.tsx`, grouped by feature under `components/` (`admin/`, `events/`, `ui/`, and so on).
- Other files are `camelCase.ts`. Hooks start with `use`.
- Route files follow Next.js names exactly (`page.tsx`, `layout.tsx`, `route.ts`).
- `@/` points at the `frontend/` root: `import { Button } from '@/components/ui/Button';`

**Components**
- Function declarations: `export function EventCard(props: EventCardProps) { ... }`.
- Named exports. Default exports only where Next.js requires them (pages, layouts, route handlers).
- Props are an `interface` named `<Component>Props`. Use `type` for unions.
- Every image has meaningful `alt` text, in both languages where the content is bilingual.

**Data**
- Shared types live in `types/` and use camelCase field names. Convert from the API's snake_case in one place, not in each component.
- New API calls go in `services/`. Older components call `fetch` directly; move those when you are already changing them.
- Show the user a plain error message and `console.error` the detail. No leftover `console.log`.

**Styling**
- Tailwind classes with the `msscc-*` tokens from `tailwind.config.ts`. Prefer a token over a hex value or an inline `style` in new code.
- Teal is the public palette. Pink is for the admin portal only and never appears on public pages.

**Text and translation**
- Static UI text goes in `messages/en.json` and `messages/ja.json`. Add every new key to both files in the same change.
- Admin-editable content comes from the backend's `_en` and `_ja` fields. Do not hardcode it in components.

## 4. Git and Jira

- One branch per story: `type/SCRUM-<storyID>-short-description`. Types are `feature`, `fix`, `chore`, `docs`.
- Commits use the subtask ID: `feat(SCRUM-379): add AdminUser model`. Imperative mood, under 72 characters, no period. With no subtask ID, drop the parentheses: `chore: move README to repo root`.
- One logical change per commit. The pre-commit hook auto-fixes what Ruff can. If it changes files, stage them and commit again.
- One PR per story, titled `[SCRUM-<storyID>] Short title`, with every section of the PR template filled in.
- At least one teammate approves. Squash and merge.

## 5. Tooling

| Tool | Where it is configured | How to run it |
|---|---|---|
| Ruff (backend lint) | `backend/ruff.toml` | `ruff check backend` from the repo root |
| ESLint (frontend lint) | `frontend/.eslintrc.json` | `npm run lint` in `frontend/` |
| TypeScript | `frontend/tsconfig.json` | `npx tsc --noEmit` in `frontend/` |
| Pre-commit | `.pre-commit-config.yaml` | `pre-commit install` once per clone; runs Ruff (with `--fix`) and ESLint on staged files at commit time |
| Editor defaults | `.editorconfig` | applied by your editor |
| Cline rules | `.clinerules/` | loaded by Cline |

The pre-commit hook and CI only check files you changed. Existing files may still have Ruff violations. You only need to fix them in files you touch. To check your own changes, run `ruff check <the files you changed>`.

Changing a rule means changing the config file and this guide in the same PR.
