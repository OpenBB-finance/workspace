---
name: pr-review
description: Review code changes using the project's PR review checklist. Use when asked to review a PR, review code, check code quality, or validate changes before merge.
allowed-tools: Read, Glob, Grep, Bash, LSP
---

# PR Review Skill

When asked to review code or a PR, follow the project's review guidelines.

## Instructions

### LLM Review Protocol (must follow)

Scope & evidence:
- Review ONLY changes in the PR diff (or the files explicitly provided). Do not comment on unrelated code.
- Every finding must include evidence: file path + line (or nearby identifier) + what changed.

Severity & precedence:
- Blocking = correctness, security, broken functionality, missing/insufficient tests for meaningful logic changes, **performance violations** (see below).
- Should fix = important maintainability/pattern issues that increase risk.
- Suggestions = style/nits; default here unless it meaningfully impacts correctness/security/perf.
- Should fix = complex functions (async flows, state mutations, imperative `getState()` calls) missing a JSDoc `/** ... */` explaining purpose, assumptions, and non-obvious design decisions.

**Performance issues are BLOCKING** (per REVIEW.md "Performance is critical"):
- Unmemoized callbacks passed to children or in dependency arrays (missing `useCallback`)
- Unmemoized derived state (missing `useMemo` for computed values)
- Inline objects/arrays in JSX that cause re-renders
- Multiple iterations on same array that should be single-pass
- Sequential `await`s of independent requests that should run in parallel (`Promise.all`, parallel `useQuery`s)
- Multiple back-to-back Zustand `set`/`setState` calls that could be one atomic update (extra renders, torn intermediate state)
- Never put a useEffect hook on the widget.hooks.tsx that changes the definition logic - This causes rendering/perf issues (check the helpers.ts for where it should go for update widget endpoints)

**Code complexity issues are BLOCKING** when they create real risk:
- The PR pushes a hook/component past ~300-400 lines mixing multiple concerns — ask whether it should be decomposed first, before the feature lands (don't flag pre-existing large files the PR barely touches)
- Duplicated logic that should be extracted (3+ similar blocks)

**Spaghetti growth is a SHOULD FIX** (BLOCKING when it lands in `src/components/ds` or `src/components/ui`):
- Feature-specific props or `isXMode` booleans added to shared `ds`/`ui` components — reuse rules cut both ways: don't pollute shared components with feature branches
- One-off booleans drilled through several component layers instead of composition or a store slice
- Feature checks or special-case conditionals added inside shared hooks/utilities they don't belong in

**Type-boundary issues are a SHOULD FIX** (beyond the existing no-`any` rule):
- `as` casts, especially on API responses, instead of proper typed contracts
- Non-null assertions (`!`) papering over an unclear invariant
- Optional props/params added just to widen an existing contract
- Silent fallbacks (`?? defaultValue`) hiding a boundary that should be explicit

**Unnecessary abstraction is a SHOULD FIX** issue:
- New function/config created when modifying an existing one would suffice (e.g., adding a parameter, changing config values)
- When reviewing new functions, check if similar functions already exist that could be extended instead
- Ask: "Could this be achieved by modifying the existing function/config rather than creating a new one?"
- Example: Creating `sanitizeHtmlArtifact()` when `sanitizeHtml()` config could just be updated is over-engineering

**Missed simplification is a SHOULD FIX** — for every meaningful change, ask:
- Could this change be reframed so branches, modes, or helper layers disappear entirely, rather than just being tidied?
- Are repeated conditionals signaling a missing model or missing helper?
- Is this a bespoke helper for something the codebase already has a canonical utility for?
- Keep the existing "prefer minimal fixes" rule: suggest the simpler structure, but don't demand large refactors unless the complexity creates real risk.

**Semantic color token violations are BLOCKING** (primitive `dark:` pairs break design system consistency and are harder to maintain):
- Using `bg-white dark:bg-dark-900` instead of `bg-general-bg-primary`
- Using `text-light-600 dark:text-light-100` instead of `text-ds-text-body`
- Using `border-light-200 dark:border-dark-800` instead of `border-general-border-secondary`
- Any primitive color pair with `dark:` prefix where a semantic token from `src/styles/tokens.css` exists
- Exception: status indicator dots needing distinct per-theme shades, or forced-light contexts (login/onboarding)
- See REVIEW.md Section 7 for the full token cheat-sheet

**Environment variable / runtime config violations are BLOCKING** (partial wiring silently breaks on-prem builds):
- Direct `import.meta.env.VITE_*` reads in component/business code instead of using `getConfig()`
- New config field not wired in all 5 required places (schema, `buildConfigFromEnv`, `generateRuntimeConfigPlugin`, `public/config.js`, test mock)
- `getConfig()` called at module scope (outside a function body) — creates stale closures
- Default values scattered outside the Zod schema in `runtimeConfigSchema.ts`
- Tests using `vi.stubEnv("VITE_*")` instead of `mockConfig` mutations

**Filename case collisions are BLOCKING** (break module resolution on case-insensitive filesystems like macOS/Windows):
- A new file whose basename differs from a sibling's only by capitalization and/or extension (e.g. `SubmissionChecks.tsx` next to `submissionChecks.ts`) — an extensionless import like `./SubmissionChecks` resolves to the wrong file (Vite probes `.ts` before `.tsx`), producing confusing "no export" errors
- Rename so basenames are case-insensitively distinct (e.g. `submissionChecks.ts` → `submissionCheckUtils.ts`)

Behavior:
- Prefer minimal fixes; don't request large refactors unless they reduce real risk.
- If something can't be verified from the diff (tests passing, runtime behavior), say so and recommend a specific check.
- Do NOT automatically run tests (unit, integration, e2e). Only run tests if the user explicitly requests it when invoking the skill. Review test code quality from the diff, but don't execute them.

### Writing style: ASD-STE100 (Simplified Technical English) — MANDATORY

Write every finding, heading, and summary in ASD-STE100 Simplified Technical English. This applies to the review text only; it does not change what you flag or the severity you assign. Suggested code stays idiomatic TypeScript.

Rules:
- **One idea per sentence.** Maximum 20 words for a descriptive sentence, 20 for an instruction.
- **Maximum 6 sentences per paragraph.** Prefer bullets to paragraphs.
- **Active voice only.** Write "`useUserStore` reads stale state", not "stale state is read by `useUserStore`".
- **Say who does what.** Name the actor: the component, the hook, the function, the reviewer, the author.
- **Simple tenses only** — present, simple past, or `will` + verb. No perfect tenses ("has caused"), no continuous tenses ("is causing"), no conditionals stacked on modals ("would have needed to be").
- **One word, one meaning.** Use the same word for the same thing each time. Do not switch between "component", "element", and "widget" for one object.
- **Approved words.** Prefer short, common verbs and nouns. Code identifiers, file paths, type names, library names, and product names are technical names — always allowed as written.
- **No -ing forms as verbs or nouns** where a simple verb works. Write "This call re-renders the list", not "This is causing re-rendering of the list".
- **Keep the articles.** Write "the callback", not "callback".
- **No noun clusters longer than three words.** Break "widget definition update logic" into "the logic that updates the widget definition".
- **No idioms, slang, metaphors, or hedging.** Do not write "this smells", "bit of a footgun", "might potentially". State the fact.
- **Give instructions as direct commands.** Write "Wrap `handleSelect` in `useCallback`." Do not write "It would probably be good to consider wrapping...".
- **State the cause and the effect in separate sentences.** First the fact, then the consequence.
- **Write negatives as warnings, not as hidden conditions.** Write "Do not call `getState()` in the render body. This call reads stale state."

Example rewrite:
- Before: "It seems like this might be causing unnecessary re-renders because the object being passed down isn't memoized, which could potentially degrade performance."
- After: "`ChartPanel` receives a new object on each render. The object is not memoized. This causes an unnecessary re-render of the child. Wrap the object in `useMemo`."


1. **Read the review checklist**: Start by reading `REVIEW.md` to understand the review criteria
2. **Identify what to review**:
   - If a PR number is given, use `gh pr diff <number>` to get the changes
   - If files are specified, read those files
   - If nothing specified, assume it's the current PR and compare it with `origin/develop` branch
3. **Run typecheck on changed files**:
     - Get the list of changed `.ts`/`.tsx` files from the PR
     - Run `npm run typecheck` to check the entire project
     - Filter the output to only report errors in files that are part of the PR
     - Report any type errors as **Blocking** issues (type errors must be fixed before merge)
     - Example workflow:
       ```bash
       # Get changed files
       gh pr diff <number> --name-only | grep -E '\.(ts|tsx)$' > /tmp/pr_files.txt
       # Run typecheck and capture output
       npm run typecheck 2>&1 | tee /tmp/typecheck_output.txt
       # Filter to PR files only
       grep -F -f /tmp/pr_files.txt /tmp/typecheck_output.txt
       ```
4. **Go through each checklist section** from REVIEW.md:
   - Tests (most important)
   - Code Quality
   - TypeScript
   - React Patterns
   - API & Data Handling
   - Security
   - Styling
   - File Organization
   - Configuration & Environment Variables
   - **Simplicity check**: If new functions/configs are added, verify they couldn't be achieved by modifying existing ones
   - **Structural check**: Apply the "Missed simplification" and "Spaghetti growth" questions above to each meaningful change
   - **Semantic tokens check**: Any new/changed UI code must use semantic color tokens — flag primitive `dark:` pairs as Blocking
5. **Report findings** organized by severity:
   - **Blocking**: Must fix before merge (missing tests, security issues, broken functionality, performance violations, excessive complexity)
   - **Should fix**: Important but not blocking (code quality, patterns)
   - **Suggestions**: Nice to have (minor improvements, nitpicks)
   - **System Impact**: System level integration considerations
   - Prefer a small number of high-conviction findings over a long list of cosmetic notes — don't flood Suggestions when there are larger structural issues to discuss
6. **Check the writing before you send it**: re-read the review against the ASD-STE100 rules above. Split any sentence longer than 20 words. Remove passive voice, -ing forms, and hedging words.

## Key files to reference

- `REVIEW.md` - The full review checklist
- `TESTING.md` - For validating test quality
- `CLAUDE.md` - For project conventions
- `docs/product-context.md` - Product and architecture background for Workspace

## Output format

Write all text in ASD-STE100 Simplified Technical English (see the writing style rules above).

```
## PR Review: [description]

### Type Errors (Blocking)
- [ ] `src/file.ts:42` - Type 'X' is not assignable to type 'Y'

### Blocking Issues
- [ ] Issue 1 (file:line)
- [ ] Issue 2 (file:line)

### Should Fix
- [ ] Issue 1
- [ ] Issue 2

### Suggestions
- Suggestion 1
- Suggestion 2

### What's Good
- Positive observation 1
- Positive observation 2

### System Impact
- Summary
```
