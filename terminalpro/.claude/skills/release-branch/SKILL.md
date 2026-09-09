---
name: release-branch
description: >
  Cut a terminalpro release branch from main with develop's tree (the
  main→release overlay process). Use when asked to make a release, cut a
  release branch, release/X.Y.Z, ship to main, or /release-branch.
  FE-only release flow for this repo. Works on macOS, Linux, and Windows
  (Git Bash / WSL / agent shell).
allowed-tools: Read, Bash, Grep, Glob, Edit
user-invocable: true
---

# Release Branch Skill

Create `release/X.Y.Z` based on `main`, with a tree that **exactly matches
`develop`**, then open a PR into `main`.

This is the automated version of Juan's process:

1. Snapshot develop (excluding `.git` / `node_modules`)
2. Branch from main as `release/X.Y.Z`
3. Merge develop
4. Wipe working tree (keep `.git` / `node_modules`)
5. Paste develop tree → commit

We do the same with git-native ops — no desktop copy-paste.

## Platform notes (Windows included)

| Environment | Supported? | Notes |
|-------------|------------|--------|
| macOS / Linux bash | Yes | Default |
| Windows **Git Bash** | Yes | Preferred on Windows |
| Windows **WSL** | Yes | Treat as Linux |
| Windows **PowerShell / CMD** | Yes* | Stick to plain `git` / `gh` lines below — no bashisms |
| Claude / Cursor / Grok agent on Windows | Yes | Agent runs the same git commands |

\* Commands below avoid bash-only syntax (`|| true`, `$VAR`, `$(...)`, `head`, line continuations with `\`).
Substitute the version number literally (e.g. `6.2.1`) — do not rely on shell variables.

**Windows gotchas:**
- Prefer **Git Bash** if running by hand. PowerShell works if you copy each `git`/`gh` line as-is.
- Close anything locking the repo (dev server, IDE file watchers) before `git clean` / `read-tree` — Windows file locks are common.
- Do not open `node_modules` in Explorer during the run.
- If `git clean` fails with "Permission denied", stop Node/Vite processes and retry that step only.
- Case-insensitive FS: do not manually rename files mid-flow; trust `read-tree`.

## Why this weird flow

`main` and `develop` diverge hard. A normal merge is conflict hell.
Goal: PR into `main` whose **file tree == develop**, with clean ancestry
from `main` + a merge parent from `develop`.

## Input

User must provide the **version** (e.g. `6.2.1`).

```
/release-branch 6.2.1
```

If missing, ask. Do not invent a version.

Optional flags the user may pass:
- `--dry-run` — print plan, execute nothing that mutates remotes
- `--no-pr` — create branch + commit only, do not open PR
- `--push` — push after commit (default: ask before push/PR)

In all commands below, replace `X.Y.Z` with the real version.

## Preflight (do all, fail fast)

Run each line separately (Windows-safe — no pipes required for control flow):

```bash
git rev-parse --show-toplevel
git status --porcelain
git fetch origin develop main
git log origin/main --oneline -20
git show origin/develop:CHANGELOG.md
git branch --show-current
git ls-remote --heads origin release/X.Y.Z
```

Checks:
1. Working tree clean (`status --porcelain` empty, or only ignored junk). If dirty → STOP, stash/commit.
2. CHANGELOG on `origin/main` must **not** already contain `## Version X.Y.Z`. If it does → STOP.
3. CHANGELOG on `origin/develop` should show `## Version X.Y.Z` near the top. If missing → WARN and ask (changelog PR may not be merged).
4. If `git ls-remote` returns a line for `release/X.Y.Z` → STOP and ask before overwriting remote.

If anything fails preflight, stop. Do not force ahead.

## Execution

### 1. Create branch from main

```bash
git checkout -B release/X.Y.Z origin/main
```

`-B` recreates a local branch if it already exists.

### 2. Merge develop (for ancestry), force tree = develop

Juan's wipe+paste becomes pure git:

```bash
git merge --no-commit --no-ff origin/develop
```

**Expected:** this often exits non-zero with conflicts. That is OK — do **not** abort.
Continue immediately (do not run `git merge --abort`):

```bash
git read-tree -u --reset origin/develop
git clean -fd -e node_modules
git add -A
```

What each does:
- `read-tree -u --reset` — index + working tree become **exactly** `origin/develop` (replaces the Desktop copy-paste).
- `git clean -fd -e node_modules` — drop untracked leftovers; keep `node_modules` (same exclusion as Juan).
- `git add -A` — stage the merge result.

### 3. Verify tree matches develop (mandatory)

```bash
git diff --stat origin/develop
```

Must print **nothing**. If any path appears → STOP and report. Do not commit.

### 4. Commit

```bash
git commit -m "Release/X.Y.Z"
```

If git says nothing to commit (clean merge already recorded develop's tree), verify:

```bash
git log --oneline -3
git diff --stat origin/develop
```

Still must be empty vs develop.

### 5. Sanity report (before push)

```bash
git branch --show-current
git rev-parse --short origin/main
git rev-parse --short origin/develop
git rev-parse --short HEAD
git log --oneline origin/main..HEAD -20
git diff --stat origin/main...HEAD
git diff --stat origin/develop
```

Show this to the user. Last command must still be empty.

### 6. Push + PR (only after user OK, unless `--push` given)

```bash
git push -u origin release/X.Y.Z
```

```bash
gh pr create --base main --head release/X.Y.Z --title "Release/X.Y.Z" --body "Release/X.Y.Z"
```

(Single-line `gh` — no `\` continuations, works in PowerShell and Git Bash.)

Historical PR shape (do not invent fluff):

| Field | Value |
|-------|--------|
| base | `main` |
| head | `release/X.Y.Z` |
| title | `Release/X.Y.Z` |
| body | `Release/X.Y.Z` |

Examples: #2092 (6.2.0), #2085 (6.1.0), #2079 (6.0.0).

### 7. Report

```
## Release branch ready

- Version: X.Y.Z
- Branch: release/X.Y.Z
- Tree matches origin/develop: YES/NO
- Pushed: YES/NO
- PR: <url or "not created">
- OS/shell: <if known, note Windows + Git Bash / PowerShell / WSL>

### Next
- Get PR review / merge into main
- Tag / deploy happens outside this skill (ops)
```

## Hard rules

1. **Never force-push** `main` or `develop`.
2. **Never push** without explicit user OK (or `--push`).
3. **Never invent a version number.**
4. Working tree must be clean before starting.
5. Final tree **must** match `origin/develop` (`git diff origin/develop` empty).
6. This skill only cuts the release branch/PR. It does **not**:
   - bump package.json version (this repo stays at `0.0.0`)
   - write the changelog (use `/changelog` first if needed)
   - deploy, tag, or touch backend repos
7. If user is mid-feature on another branch, note their previous branch;
   do not switch them back unless they ask.
8. Do **not** use desktop/temp-folder copy-paste. Git ops only.
   (Juan's method is the source of truth for *intent*; this skill is the
   safer cross-platform implementation of that intent.)
9. Prefer **one command per invocation** when the agent is on Windows PowerShell,
   so a non-zero merge exit does not cancel the rest of a chained script.

## Dry-run mode

When `--dry-run` or user says "just show me":

1. Run preflight only
2. Print the exact commands that would run (with version filled in)
3. Exit without checkout/merge/commit/push

## Common failure modes

| Symptom | Fix |
|---------|-----|
| dirty working tree | stash or commit first |
| `release/X.Y.Z` already on remote | ask: abort, or delete remote branch + redo |
| changelog missing on develop | finish changelog PR, then re-run |
| `git diff origin/develop` not empty after read-tree | stop; paste output; do not force |
| merge aborts weirdly | `git merge --abort`, re-run from step 1 |
| Windows "Permission denied" on clean/checkout | kill node/vite/IDE locks; retry |
| `gh` not found | install [GitHub CLI](https://cli.github.com/) and `gh auth login` |
| agent chained `merge && read-tree` and stopped on merge | re-run from `read-tree` — conflicts are expected |

## Relation to other skills

- `/changelog <PR#>` — generate CHANGELOG entry **before** cutting release
  (changelog should already be on `develop`)
- `/sync-develop` — unrelated; for feature PR branches syncing with develop