# Git and Jira workflow

- Jira project key is `SCRUM`. Work is organized as stories with subtasks.
- Branch per story: `type/SCRUM-<storyID>-short-description`, lowercase, hyphens, 3 to 5 words. Types: `feature`, `fix`, `chore`, `docs`. Never work on `main`.
- Commits use Conventional Commits with the subtask ID: `type(SCRUM-<subtaskID>): short description`.
  - Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `test`.
  - Imperative mood, lowercase start, no trailing period, under 72 characters.
  - No subtask ID: omit the parentheses (`chore: move README to repo root`).
  - If the subtask ID is unknown, ask before writing the message.
- One logical change per commit. Auto-fix output and hand fixes go in separate commits.
- One PR per story, opened after all subtasks are committed. Title: `[SCRUM-<storyID>] Short title`. Fill in every section of `.github/PULL_REQUEST_TEMPLATE.md`.
- Squash and merge into `main` after at least one teammate approves.
- Cline drafts commit messages and PR text. The human runs state-changing git commands (see `security.md`).
