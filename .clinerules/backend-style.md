---
paths:
  - "backend/**"
---

# Backend style (Django / DRF)

Source: docs/coding-style-guide.md, section 2. Code must pass ruff check backend.

## Formatting
- 4-space indent, max 100 characters per line, double quotes for strings.
- Two blank lines before top-level definitions; one between methods.
- New and edited code follows these rules. Do not requote or reformat untouched lines (see `project-context.md`).

## Naming
- `snake_case` for variables, functions, modules, and apps; `PascalCase` for classes; `UPPER_SNAKE_CASE` for constants and settings.
- Models are singular `PascalCase` (`Event`, `DonationRecord`). URL strings are kebab-case (`"event-list/"`).
- Bilingual fields come in pairs with `_en` / `_ja` suffixes (`title_en`, `title_ja`).

## Imports
- Groups in order, one blank line between: standard library, third-party (Django and DRF included), local apps, relative same-app imports.
- Absolute imports across apps. `from .models import X` is fine within an app; never `..`.
- No wildcard imports, except `from .base import *  # noqa: F403` in `config/settings/development.py` and `production.py`. Those files import anything they use directly (for example `import os`) instead of relying on the star import.

## Django and DRF
- Model member order: fields, `class Meta`, `__str__`, `save`/`clean` overrides, properties, other methods.
- Serializers list `fields` explicitly; never `fields = "__all__"`. Protect server-controlled fields with `read_only_fields`.
- Prefer ViewSets or `APIView` classes for resources; `@api_view` only for one-off endpoints. Set `permission_classes` explicitly on every view.
- Settings read from `os.environ` / `os.getenv`, grouped under a comment header. Required secrets fail fast; never give a secret a default value.
- Model changes need a migration in the same story. Follow the `django-migrations` skill.

## Typing, docstrings, errors
- Type hints are encouraged on new functions, mainly services and helpers; not required. Use `X | None`, not `Optional[X]` (Python 3.12).
- Public classes and functions get a docstring. One line is enough when the name says most of it. No module docstrings.
- Catch specific exceptions. No bare `except:`; no silent `pass` without a reason.
- Never return raw exception text, Stripe errors, or internal references to the client. Log with `logging.getLogger(__name__)`, never `print`.

## Comments and tests
- Explain why, not what. `# TODO(name): ...` for follow-ups. No commented-out code.
- Tests: `tests.py` or `test_<topic>.py`, classes `<Thing>Tests`, methods `test_<behavior>`.
