---
name: fix-with-test
description: Reproduce-and-fix loop for bugs and defects. Write a FAILING test that reproduces the bug FIRST, confirm it fails for the RIGHT reason, apply the minimal fix, confirm it passes — the test stays as a regression guard. Use when fixing a reported bug, "X is broken / doesn't work", wrong/unexpected behavior, or hardening a defect-prone path. For adding coverage to already-working code, use `write-tests` instead.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
---

# Fix With Test

Kill a bug by first proving it exists with a failing test, then making that test pass with the
smallest possible change. The fix is the deliverable; the test is the proof and the regression guard.

This skill owns the **loop discipline and the failure-mode guards**. It does NOT re-document how to
write a test — for conventions (file location, RTL/hook/MSW patterns, selectors) read `TESTING.md`
and use the `write-tests` skill.

## When to use vs not

- **Use this** when there is a defect: a reported bug, "X is broken", a wrong value/state/render, a
  regression. You are reproducing then fixing.
- **Use `write-tests`** when the code works and you are adding coverage, or doing greenfield feature TDD.
- **E2E flows** (multi-page, browser) → see `TESTING.md` §E2E, not this skill.

## The loop

```text
0. Locate root cause      -> verify: you can point at the file:line that is wrong
1. Choose the layer       -> verify: failing there implicates ONLY the real bug (Guard 4)
2. Write the failing test -> asserts the CORRECT behavior, mirrors tests/unit/ structure
3. Run target file -> RED -> verify: fails, and fails for the RIGHT reason (Guards 1-3)
4. Apply the minimal fix  -> verify: smallest change that addresses root cause (Guard 5)
5. Run target file -> GREEN
6. Typecheck changed files
7. Leave the test in place; commit test + fix together
```

Run only the target file in the inner loop. The full suite is a PR/CI gate, not a per-iteration step.

## The 5 guards (the part that matters)

**Guard 1 — Confirm RED before you fix.** Run the new test against the *unpatched* code. It MUST
fail. If it passes, **STOP** — it is not a reproduction. Either the bug is not where you think, or
the test does not exercise the broken path. Re-investigate; do not proceed to a "fix".

**Guard 2 — Red for the RIGHT reason.** Read the failure output, not just the exit code. The failing
*assertion* must describe the actual defect (wrong value/state/text). Reject these **fake reds** and
fix them before continuing — they are not reproductions:
- module-resolution / missing dependency errors (e.g. an uninstalled dep)
- type or syntax error in the test itself
- wrong selector / `data-testid` / role query
- unmocked network call, or a `waitFor` timeout
A green-after-fix means nothing if the red was fake.

**Guard 3 — Beware mock-induced signals.** A heavily-mocked component test can pass or fail for
*mock* reasons, not real-code reasons. If a mock sits between the test and the buggy code, confirm
the mock faithfully models the real unit. Example: a design-system atom mocked as a dumb `<input>`
will not reflect tri-state / `indeterminate` / `aria-*` — assertions on those are meaningless until
the mock models them. Either make the mock faithful, or move the test down a layer.

**Guard 4 — Reproduce at the lowest faithful layer.** Pick the layer where the test fails *only*
when the real bug is present:
- bug in pure logic/derivation → extract or locate the pure function/hook and test that (fast,
  deterministic, no mounting). Extracting a tiny pure helper for testability is justified even if
  single-use.
- bug in render/wiring/interaction → component test with RTL (mind Guard 3).
- bug in API/async handling → MSW (`TESTING.md` §MSW).

**Guard 5 — Minimal fix, no scope creep.** Smallest change that flips red→green at the root cause.
Do not weaken the test to make it pass. Do not refactor unrelated code or "improve" adjacent lines.
Every changed line should trace to this bug.

## Commands

```bash
# Inner loop: run ONLY the target test file (fast)
npx vitest run tests/unit/path/to/file.test.ts
npx vitest run tests/unit/path/to/file.test.ts -t "the specific case"

# After green: typecheck only the changed files (cheap cross-file safety; not the full suite)
files=$(git diff --name-only | grep -E '\.tsx?$')
[ -z "$files" ] && echo "no changed .ts/.tsx files" \
  || npm run typecheck 2>&1 | grep -F -f <(printf '%s\n' "$files")
```

## Done criteria

- Target test was RED on unpatched code, for a genuine assertion reason (Guards 1–3).
- Target test is GREEN after a minimal, root-cause fix (Guard 5).
- Changed files typecheck clean.
- The reproduction test remains as a permanent regression guard.

## STOP conditions

- New test is green before any fix → not a reproduction (Guard 1).
- The only way to get red is an infra/mock/selector error → fake red (Guards 2–3).
- The fix needs to touch many unrelated files → re-scope; the reproduction layer is probably wrong (Guard 4).
