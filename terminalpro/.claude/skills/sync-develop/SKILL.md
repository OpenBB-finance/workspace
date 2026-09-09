---
name: sync-develop
description: Sync current PR branch with origin/develop. Fetches latest develop, analyzes changes on both sides, merges, and resolves conflicts intelligently by understanding the intent of both the PR and newly merged develop code. Use when asked to sync, rebase, merge develop, resolve conflicts, or update branch.
allowed-tools: Read, Glob, Grep, Bash, Edit, Write
---

# Sync with Develop Skill

Intelligently sync the current PR branch with `origin/develop` by understanding context from both sides before resolving any conflicts.

## Instructions

### Phase 1: Gather Context

1. **Identify the current branch and PR**:
   ```bash
   git branch --show-current
   git fetch origin develop
   ```

2. **Find the merge base** (where the branch diverged from develop):
   ```bash
   MERGE_BASE=$(git merge-base HEAD origin/develop)
   echo "Merge base: $MERGE_BASE"
   ```

3. **Analyze the PR's changes** (what this branch is doing):
   ```bash
   # Summary of PR changes since diverging from develop
   git diff --stat $MERGE_BASE..HEAD
   # Detailed diff for understanding intent
   git log --oneline $MERGE_BASE..HEAD
   ```
   - Read the PR diff carefully to understand the **purpose and intent** of the branch
   - Identify which files are core to the PR's feature/fix vs incidental changes

4. **Analyze what landed on develop** since the branch diverged:
   ```bash
   # What merged into develop since we branched
   git log --oneline $MERGE_BASE..origin/develop
   git diff --stat $MERGE_BASE..origin/develop
   ```
   - Understand what PRs were merged and what they changed
   - Pay special attention to files that overlap with the PR's changes

5. **Predict conflicts** before merging:
   ```bash
   # Files changed on both sides
   comm -12 \
     <(git diff --name-only $MERGE_BASE..HEAD | sort) \
     <(git diff --name-only $MERGE_BASE..origin/develop | sort)
   ```
   - For each overlapping file, understand what each side changed and why

### Phase 2: Merge

6. **Attempt the merge**:
   ```bash
   git merge origin/develop --no-edit
   ```
   - If no conflicts: skip to Phase 4
   - If conflicts: proceed to Phase 3

### Phase 3: Resolve Conflicts

7. **List all conflicted files**:
   ```bash
   git diff --name-only --diff-filter=U
   ```

8. **For each conflicted file**, resolve intelligently:
   - Read the full conflicted file to see the conflict markers
   - Cross-reference with the context gathered in Phase 1
   - Apply these resolution rules:

   **Resolution Priority Rules**:
   - **PR intent wins for feature code**: If the conflict is in code that's core to the PR's feature, keep the PR's version but incorporate any non-conflicting develop changes (new imports, renamed variables, etc.)
   - **Develop wins for unrelated refactors**: If develop renamed a function/variable/file that the PR happens to use, adopt develop's naming and update the PR code accordingly
   - **Merge both for additive changes**: If both sides added new things (new imports, new functions, new list items), include both
   - **Develop wins for deleted code**: If develop removed something the PR still references, the PR code needs to adapt to the removal
   - **Semantic tokens**: If develop migrated to semantic color tokens and the PR uses old primitive tokens, adopt develop's semantic tokens
   - **Config/schema changes**: If both sides modified config schemas or similar structures, merge the fields from both - each side likely added different fields

   After resolving, stage the file:
   ```bash
   git add <resolved-file>
   ```

9. **Handle special file types carefully**:
   - `package.json` / `bun.lockb`: If conflicted, resolve `package.json` manually then run `npm install` to regenerate the lockfile
   - `index.css` / token files: Both sides may have added tokens - include all
   - Test files: If the PR's test file conflicts with develop, the PR's tests are likely more relevant but may need updating to match develop's API changes

### Phase 4: Finalize Merge Commit

10. **Ensure all resolved files are staged and complete the merge**:
    ```bash
    # Verify no remaining conflicts
    git diff --name-only --diff-filter=U
    # If clean, finalize the merge commit
    git commit --no-edit
    ```
    - If `git merge --no-edit` already committed (no conflicts case), this step is a no-op
    - If there were conflicts that you resolved, this creates the merge commit

### Phase 5: Verify & Fix

11. **Run typecheck on affected files**:
    ```bash
    # Get all files touched by PR + merge
    git diff --name-only origin/develop..HEAD | grep -E '\.(ts|tsx)$' > /tmp/merged_files.txt
    sort -u /tmp/merged_files.txt -o /tmp/merged_files.txt
    # Typecheck
    npm run typecheck 2>&1 | tee /tmp/typecheck_output.txt
    # Filter to relevant files
    grep -F -f /tmp/merged_files.txt /tmp/typecheck_output.txt || echo "No type errors in merged files"
    ```

12. **Fix any type errors** introduced by the merge - these usually come from:
    - develop renaming/removing types the PR still uses
    - develop changing function signatures the PR calls
    - Import paths changing on develop

13. **Run tests** for affected areas (ideally only affected so we dont run all the tests or waste time):
    ```bash
    bunx vitest run --reporter=verbose 2>&1 | tail -30
    ```

14. **If any fixes were needed (type errors, test fixes), commit them**:
    ```bash
    git add -A
    git commit -m "fix: post-merge fixes after syncing with develop"
    ```
    - Only create this commit if there were actual fixes. Skip if everything was clean.

### Phase 6: Ensure Push-Ready State

15. **Verify the branch is in a clean, pushable state**:
    ```bash
    # Must show "nothing to commit, working tree clean"
    git status
    # Verify we're ahead of remote and can push
    git log --oneline @{upstream}..HEAD 2>/dev/null || echo "No upstream tracking - will need: git push -u origin $(git branch --show-current)"
    ```
    - If the branch has no upstream, note the push command needed
    - The branch should be left with a clean working tree and no pending changes

### Phase 7: Report

16. **Summarize what happened**:
    - How many commits from develop were merged
    - Which files had conflicts and how they were resolved
    - Any type errors that were fixed
    - Any test failures and their resolution
    - Anything that needs manual review or looks risky

## Output Format

```
## Sync with develop

### Develop Changes
- X commits merged from develop
- Key PRs: [list notable merged PRs]

### Conflicts Resolved
- `path/to/file.tsx` - [how it was resolved and why]
- `path/to/other.ts` - [how it was resolved and why]

### Post-merge Fixes
- [type errors fixed]
- [import updates]

### Verification
- Typecheck: PASS/FAIL
- Tests: PASS/FAIL (X passed, Y failed)

### Push Status
- Branch is clean and ready to push: YES/NO
- Push command: `git push` (or `git push -u origin <branch>` if no upstream)

### Needs Attention
- [anything risky or needing manual review]
```

## Important Notes

- **Never force-push** or rewrite history without explicit user request
- **Never blindly accept "ours" or "theirs"** - always understand context first
- If a conflict is ambiguous and you can't determine the right resolution, **ask the user**
- If develop made breaking changes that require significant PR rework, **stop and report** rather than guessing
- Commit the merge with the default merge commit message (don't customize it)
