---
paths:
  - "frontend/**"
---

# Frontend style (Next.js / TypeScript)

Source: team coding style guide, section 3. Enforced by `npm run lint` (`next/core-web-vitals` + `next/typescript`). Prettier and clsx are not installed; do not add them.

## Formatting
- 2-space indent, max 100 characters per line, semicolons, trailing commas in multiline lists.
- Single quotes for strings; double quotes for JSX attributes.
- Always parenthesize arrow function parameters: `(x) => x + 1`.

## Naming
- Variables and functions `camelCase`; constants `UPPER_SNAKE_CASE`; types, interfaces, components `PascalCase`.
- Component files `PascalCase.tsx`; other files `camelCase.ts`; hooks start with `use`.
- Next.js route files follow Next conventions exactly (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `route.ts`).

## Imports
- Order with one blank line between groups: React/Next, third-party, `@/` utilities and hooks, `@/` components, types (`import type`), styles.
- `@/` maps to the `frontend/` root (not `frontend/src/`).
- Named exports for new components. Default exports only where Next.js requires them (pages, layouts, route files).

## TypeScript
- No `any`. Use `unknown` and narrow.
- `interface` for object shapes, `type` for unions and intersections. No `I` prefix. Props are `<Component>Props`.
- Shared types live in `frontend/types/`. Frontend types use camelCase; convert from the backend's snake_case in the service layer (`frontend/services/`).

## React
- Function components only. Destructure props in the signature.
- `useEffect` always has an explicit dependency array; clean up subscriptions and fetches.
- Every `<img>` and `<Image>` has meaningful `alt` text.
- Never swallow errors: show a user-friendly message and `console.error` the details.

## Styling and i18n
- Tailwind utilities with the `msscc-*` tokens from `tailwind.config.ts`. Avoid custom CSS and hardcoded hex colors.
- Teal (`msscc-teal`) is the public palette. Pink (`msscc-pink`) is admin-only and must never appear on public pages.
- Public pages live under `app/[locale]/`. Static UI text (labels, buttons, nav) goes in `messages/en.json` and `messages/ja.json` via the `useTranslation` hook; add every new key to both files in the same change.
- Admin-editable page content comes from the backend's paired `*_en` / `*_ja` fields. Do not hardcode it in components.

## Comments
- Explain why, not what. JSDoc on exported utilities and hooks. `// TODO(name): ...` for follow-ups. No commented-out code.
