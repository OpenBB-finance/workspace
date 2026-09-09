---
name: fix-dependabot
description: Scan open Dependabot security alerts on this repo and fix them with targeted, minimal dependency bumps. Use when asked to fix Dependabot alerts, resolve security vulnerabilities in dependencies, or clean up npm audit findings.
allowed-tools: Read, Glob, Grep, Bash, Edit, Write
user-invocable: true
---

# Fix Dependabot Alerts

Scan the repo's open Dependabot alerts via the GitHub API and fix them with **targeted, minimal updates** — never blanket `npm audit fix`. The deliverable is a branch with `package.json`/`package-lock.json` changes, a passing test suite, and a report of what was fixed and what needs a human decision.

## Hard rules

- **NEVER run `npm audit fix --force`.** It installs major version upgrades that silently break the app.
- **Avoid blanket `npm audit fix`** — it touches unrelated packages. Do targeted per-package updates so the lockfile diff traces to specific alerts.
- **Never delete `package-lock.json`** to "regenerate" it. That unpins the whole tree.
- **Never do a major-version bump of a direct dependency automatically.** If the only fix is a major bump (or the advisory has no patched version), report it in the "Needs decision" section instead.
- **Never dismiss alerts via the API** — surface non-applicable ones (e.g. Node-only advisory in a dev-only tool) to the user with a recommendation.
- Work on a branch, not `develop`.

## Workflow

### Step 1: Fetch open alerts

```bash
gh api "repos/{owner}/{repo}/dependabot/alerts?state=open&per_page=100" --paginate --jq '
  [.[] | {
    number,
    package: .dependency.package.name,
    manifest: .dependency.manifest_path,
    scope: .dependency.scope,
    severity: .security_advisory.severity,
    summary: .security_advisory.summary,
    vulnerable_range: .security_vulnerability.vulnerable_version_range,
    patched: .security_vulnerability.first_patched_version.identifier
  }]'
```

Group alerts **by package**: one package often has many alerts (each with its own `patched` version). The target version for a package is the **highest** `first_patched_version` across all its alerts — bumping to that clears the whole group.

### Step 2: Classify each package

For each vulnerable package, determine how it enters the tree:

```bash
# Where is it installed and at what versions? (a package can appear at multiple versions)
npm ls <pkg> --all 2>&1 | head -40

# Is it a direct dependency?
node -e "const p=require('./package.json'); console.log(!!(p.dependencies?.['<pkg>'] ?? p.devDependencies?.['<pkg>']))"

# Is there already an override for it?
node -e "console.log(require('./package.json').overrides?.['<pkg>'] ?? 'none')"
```

Also note `scope` from the alert (`development` vs `runtime`) — mention it in the report; dev-only vulnerabilities are still worth fixing but are lower real-world risk for a frontend bundle.

### Step 3: Fix, in order of preference

Try these strategies per package, cheapest first. After each attempt, verify with `npm ls <pkg> --all` that **every** instance in the tree is at or above the target version — a fix that patches one path but leaves another vulnerable instance is not done.

**a. Lockfile-only bump (transitive, target version inside the parent's semver range):**

```bash
npm update <pkg>
```

This only touches `package-lock.json`. It is the ideal fix — no manifest change, minimal risk.

**b. Direct dependency, target within current major:**

```bash
npm install <pkg>@^<patched-version>
```

**c. Existing override too low:** this project already has an `overrides` block in `package.json`. If the package has an override but at a version below the target, bump the override value, then `npm install`.

**d. Transitive dep whose parent pins a vulnerable range:** add an entry to `overrides` in `package.json` (keep the existing style, e.g. `"tar": "^7.5.4"`), then `npm install`. Overrides caveats:

- Use a **plain package-name key** — do NOT use nested parent-path or version-qualified selectors (`"parent@1.x": {...}`); those are brittle and npm applies them inconsistently.
- If the package is ALSO a direct dependency, npm errors when the override conflicts with the direct spec — keep them in sync (or use `"$<pkg>"` reference syntax).
- Overrides **force** a version on parents that didn't ask for it. Semver-compatible is usually safe; if you're forcing across a major of what a parent expects, treat it as risky and call it out in the report.
- After editing, run `npm install` and confirm the lockfile actually moved (`npm ls <pkg> --all`). npm's override application has had known flakiness — if versions didn't change, remove `node_modules` and reinstall.

**e. Nothing above works** (no patched version, or fix requires a major bump of a direct dep): do NOT force it. Add it to the "Needs decision" section with the exact constraint (which parent pins it, what major bump would be required, link to the advisory).

### Step 4: Local verification of the alert set

Dependabot only rescans after a push, so use local checks as the source of truth:

```bash
# Every previously-flagged package at/above its target version?
npm ls <pkg> --all

# Cross-check with npm's own advisory DB (informational — the Dependabot alert list from Step 1 is authoritative)
npm audit 2>&1 | tail -30
```

Fixing one package can surface a previously-shadowed vulnerable version elsewhere in the tree — re-check `npm audit` after the batch and loop if a targeted fix exists.

### Step 5: Verify the app still works

Dependency bumps can change runtime behavior even when "semver-compatible". All three must pass:

```bash
npx vitest run
npm run typecheck
npm run build
```

If anything fails, bisect by reverting the most-suspect bump (majors first, then packages imported directly by `src/`), rerun, and move that package to "Needs decision".

### Step 6: Commit and report

- Commit `package.json` + `package-lock.json` together on the branch. **The lockfile is the security artifact** — an uncommitted lockfile means CI's `npm ci` restores the vulnerable versions.
- Do not commit `node_modules` or any other stray changes.
- After the fix PR merges, Dependabot rescans and closes the alerts automatically — no manual dismissal needed.

## Output format

```
## Dependabot Fix Report

### Fixed (N alerts, M packages)
| Package | From → To | Strategy | Alerts closed | Severity |
|---------|-----------|----------|---------------|----------|
| tar | 7.4.0 → 7.5.4 | override bump | #269, #266, #270, #271 | critical, high, 2 medium |

### Needs decision
- `<pkg>` (#NN, high) — fix requires major bump X→Y of direct dependency `<parent>`; breaking changes: <one-liner>. Recommendation: ...
- `<pkg>` (#NN, low) — no patched version published yet. Recommendation: wait / override to fork / dismiss as tolerable-risk.

### Verification
- vitest: PASS (N tests)
- typecheck: PASS
- build: PASS
```

## Known gotchas (why this skill is shaped this way)

1. `npm audit fix` can silently fail to update packages yet stop reporting the vulnerability, and `--force` happily installs breaking majors — hence targeted updates only.
2. The vulnerable package is rarely one you installed directly; the fix lever differs for direct deps (manifest bump), free transitive deps (`npm update`), and pinned transitive deps (overrides).
3. `npm update <pkg>` only helps when the patched version satisfies the parent's declared range — always confirm with `npm ls` afterwards rather than trusting exit codes.
4. One package can appear at several versions in the tree; patching one instance while another stays vulnerable still leaves the alert open.
5. Fixing one advisory can expose another that was previously shadowed — always do a final `npm audit` pass.
6. Alert counts on github.com update only after the branch with the new lockfile is pushed and rescanned; don't burn time re-querying the API expecting immediate closure.
