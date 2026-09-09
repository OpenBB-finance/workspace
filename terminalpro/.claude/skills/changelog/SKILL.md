---
name: changelog
description: Generate a changelog entry from merged PRs since a specified PR number. Usage - /changelog <PR_number> to generate changelog from all PRs merged after that PR.
allowed-tools: Read, Bash, Grep, Glob
user-invocable: true
---

# Changelog Generator

Generate a formatted changelog entry by reviewing all PRs merged into `develop` since a given PR number.

## Input

The user provides a PR number as the argument. This is the **starting point** — the changelog will cover all PRs merged **after** that PR (not including it).

If no PR number is provided, ask the user for one.

## Workflow

### Step 1: Get the merge date of the reference PR

```bash
gh pr view <PR_NUMBER> --json mergedAt --jq '.mergedAt'
```

### Step 2: Fetch all merged PRs and filter by date

Use a two-pass approach to avoid output truncation from large PR bodies:

**Pass 1 — Get the list of qualifying PRs (lightweight, no body):**

```bash
gh pr list --state merged --base develop --json number,title,mergedAt,labels --limit 200 --jq '[.[] | select(.mergedAt > "REFERENCE_DATE")] | sort_by(.mergedAt) | .[] | "#\(.number) | \(.title) | \(.mergedAt[0:10])"'
```

This gives a quick, complete list of all PR numbers and titles to process.

**Pass 2 — Fetch body details per PR (only for the qualifying PRs):**

```bash
gh pr view <NUMBER> --json number,title,body --jq '{number, title, body: (.body[0:500])}'
```

Run this for each qualifying PR to get the body content needed for writing summaries. Truncating `.body[0:500]` keeps output manageable.

> **Why two passes?** Fetching `body` for all PRs in one call produces very large JSON output (50KB+) that gets truncated, causing PRs to be silently dropped. The lightweight first pass ensures no PRs are missed.

**When the body is thin or missing, read the actual changes — do NOT skip or write a generic summary.** Many PRs have one-word bodies ("up", "fix"), empty bodies, or titles like "admin fixes" that say nothing about what changed. For any PR where the title + body do not give you enough to write a specific, user-facing summary:

```bash
# See which files/areas changed and the rough size of each change
gh pr view <NUMBER> --json files --jq '.files[] | "\(.additions)+ \(.deletions)- \(.path)"'

# Read the actual diff to understand the behavior change
gh pr diff <NUMBER>
```

Use the file paths to infer the affected feature area (e.g. `src/components/AdminRoles/` → roles & permissions admin) and the diff to describe what visibly changed for the user. Never write filler like "various fixes to the admin area" when the diff shows specific changes — name them (e.g. "permission rows now show the parent template as a tag", "removed bulk role deletion"). Bundle genuinely minor polish per the significance filter below, but only after you have actually looked.

> **Note:** Avoid using `gh api` with complex `--jq` expressions containing `\n` or special characters — they have escaping issues on Windows bash. The `gh pr list` approach above is simpler and works cross-platform.

### Step 3: Analyze each PR

For each PR, determine:
1. **Category**: Is it a New Feature, Bug Fix/Improvement, or Breaking Change?
   - PRs with titles starting with `feat:` or `feature:` → New Feature
   - PRs with titles starting with `fix:` or `bugfix:` → Bug Fix
   - PRs with titles starting with `refactor:`, `chore:`, `style:`, `perf:`, `docs:` → Improvement
   - PRs with "breaking" in title or body → Breaking Change
   - If unclear, use your judgement based on the PR title and body content
2. **Summary**: Write a concise, user-facing description (1-3 sentences if possible). Some PRs contain a lot of changes and for different things. Do NOT use developer jargon — write it as if explaining to a product user. If the body does not give you enough to be specific, read the diff first (see Step 2) — never summarize from the title alone.
3. **Heading**: Create a short, descriptive heading (like "PDF Export" or "Redesigned Sidebar Navigation")

### Step 4: Generate the changelog

Use this exact format matching the project's `CHANGELOG.md`:

```markdown
## Version X.X.X - Month Dayth, Year

### New Features

- #### Feature Heading

  User-facing description of the feature.

---

- #### Another Feature Heading

  User-facing description.

### Bug Fixes and Improvements

- #### Fix/Improvement Heading

  User-facing description.

- #### Another Fix Heading

  Description.

### Breaking Changes

- #### Breaking Change Heading

  Description of what changed and what users need to do.
```

## Format Rules

1. **New Features** are separated by `---` horizontal rules between each entry
2. **Bug Fixes and Improvements** do NOT have `---` separators between entries
3. **Breaking Changes** section is only included if there are breaking changes
4. Omit any section header that has no entries (e.g., don't include "### Breaking Changes" if there are none)
5. Use `Month Dayth, Year` date format (e.g., "March 19th, 2026")
6. Leave the version number as `X.X.X` — the user will fill that in
7. Each entry heading uses `#### Heading` inside a list item (`- ####`)
8. Description is indented with 2 spaces under the heading

## Output

1. First, output a **summary table** of all PRs found:

```
| PR # | Title | Category | Merged |
|------|-------|----------|--------|
| #1234 | feat: Add dark mode | New Feature | 2026-03-15 |
| #1235 | fix: PDF export crash | Bug Fix | 2026-03-16 |
```

2. Then output the **formatted changelog entry** in a code block so the user can copy it.

3. After the changelog, note any PRs you **excluded** (e.g., dependency bumps, CI-only changes, merge commits) and explain why.

## Significance Filter — What Gets Its Own Entry vs. Gets Bundled

Not every PR deserves its own changelog entry. Apply this filter when deciding how to present changes:

### Gets its own entry (noteworthy to users)
- New user-facing features or capabilities (e.g., new search dialog, new skills platform)
- Significant UI redesigns that change how users interact with something (e.g., redesigned sidebar, new mobile layout)
- Security fixes
- Bug fixes that users would have noticed or reported (e.g., widgets disappearing, data not loading)
- Breaking changes

### Bundle into "General UI Improvements" (not individually noteworthy)
- Minor alignment/spacing/padding tweaks (e.g., centering avatars, fixing icon stroke width, adjusting padding)
- Icon swaps or refreshes that don't change functionality
- Small visual polish (font size adjustments, divider styling, toast alignment)
- Internal refactors of component layouts with no meaningful UX change
- Design token or theming infrastructure changes

Collect all the bundled items into a single **"General UI Improvements"** entry under Bug Fixes and Improvements. List the specific areas touched in 1-2 sentences, e.g.:

```markdown
- #### General UI Improvements

  Various visual polish and consistency fixes across the interface, including icon updates, spacing adjustments, toast notification alignment, widget menu styling, and standardized table row heights.
```

This keeps the changelog focused on what users actually care about, while still acknowledging that polish work happened.

## Notes

- Skip PRs that are purely internal (CI/CD config, dependency bumps, merge commits from syncing branches) unless they have user-facing impact.
- If a PR body contains a "Summary" or "Changes" section, use that to write a better description.
- Group related PRs together under a single changelog entry if they address the same feature/fix.
- When in doubt about categorization, default to "Bug Fixes and Improvements".