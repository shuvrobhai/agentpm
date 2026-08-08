# 7. GitHub Monorepo and Subfolder (`/tree/`) URL Parsing

- Status: Accepted
- Date: 2026-08-08

## Context and Problem Statement
When users copy a repository link directly from their browser URL bar (e.g., `https://github.com/anthropics/knowledge-work-plugins/tree/main/productivity`), the URL includes GitHub web UI paths such as `/tree/<branch>/<subfolder>`. Passing this URL directly to `git clone` fails because `.../tree/main/productivity.git` is not a valid Git endpoint.

## Decision Drivers
- User Experience: Users frequently copy URLs directly from GitHub browser tabs without stripping `/tree/...` paths manually.
- Resilience: The installer should gracefully parse browser web URLs into valid Git clone origins and branch references.

## Considered Options
1. Require manual input of clean `owner/repo` or raw `.git` URLs.
2. Auto-parse `/tree/<branch>/<path>` in `GlobalStore.parseRepoIdentifier()` (Chosen).

## Decision Outcome
Chosen option: "Auto-parse `/tree/<branch>/<path>` in `GlobalStore.parseRepoIdentifier()`".
- When an input URL contains `/tree/`, `parseRepoIdentifier` splits the URL into the root Git repository URL (e.g., `https://github.com/anthropics/knowledge-work-plugins.git`) and extracts the branch/ref (e.g., `main`).
- The installer shallow-clones the root repository under the resolved ref, allowing users to enable and access nested skills within the repository.
