---
paths:
  - "backend/**"
---

# Backend style (Django / DRF)

Source: team coding style guide, section 2 (PEP 8 baseline). Until the committed Ruff config lands, code must pass `ruff check backend` with Ruff's default rules (pyflakes plus core pycodestyle errors).

## Formatting
- 4-space indent, max 100 characters per line, double quotes for strings.
- Two blank lines before top-level definitions; one between methods.
- New and edited code follows these rules. Do not requote or reformat untouched lines (see `project-context.md`).

## Naming
- `snake_case` for variables, functions, modules, and apps; `PascalCase` for classes; `UPPER_SNAKE_CASE` for constants and settings.
- Models are singular `PascalCase` (`Event`, `DonationRecord`). URL strings are kebab-case (`"event-list/"`).
- Bilingual fields come in pairs with `_en` / `_ja` suffixes (`title_en`, `title_ja`).

## Imports
- Groups in order, one blank line between: standard library, third-party, Django and DRF, local apps.
- Absolute imports across apps. `from .models import X` is fine within an app; never `..`.
- No wildcard imports, except `from .base import *  # noqa: F403` in `config/settings/development.py` and `production.py`. Those files import anything they use directly (for example `import os`) instead of relying on the star import.

## Django and DRF
- Model member order: fields, `class Meta`, `__str__`, `save`/`clean` overrides, properties, other methods.
- Serializers list `fields` explicitly; never `fields = "__all__"`. Protect server-controlled fields with `read_only_fields`.
- Prefer ViewSets or `APIView` classes for resources; `@api_view` only for one-off endpoints. Set `permission_classes` explicitly on every view.
- Settings read from `os.environ` / `os.getenv`, grouped under a comment header. Required secrets fail fast; never give a secret a default value.
- Model changes need a migration in the same story. Follow the `django-migrations` skill.

## Typing, docstrings, errors
- Type hints on all function signatures. Use `X | None`, not `Optional[X]` (Python 3.12).
- Every public class and function has a PEP 257 docstring (Google style `Args` / `Returns` / `Raises` when multi-line). Private helpers get at least one line.
- Catch specific exceptions. No bare `except:`; no silent `pass` without a reason.
- Never return raw exception text, Stripe errors, or internal references to the client. Log with `logging.getLogger(__name__)`, never `print`.

## Comments and tests
- Explain why, not what. `# TODO(name): ...` for follow-ups. No commented-out code.
- Tests: `test_<module>.py`, classes `Test<Thing>`, methods `test_<behavior>`.
