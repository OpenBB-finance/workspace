---
name: write-tests
description: Write tests following TDD workflow and project testing conventions. Use when asked to write tests, add test coverage, implement TDD, or test a component/hook/utility.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
---

# Write Tests Skill

When asked to write tests, follow the project's TDD workflow and testing conventions.

> **Fixing a bug instead?** Use the `fix-with-test` skill — it owns the reproduce-and-fix
> red-green loop (failing test first, then fix) and its failure-mode guards. This skill is for
> adding coverage to working code and greenfield feature TDD.

## Instructions

1. **Read the testing guide**: Start by reading `TESTING.md` to understand patterns and conventions
2. **Understand what to test**:
   - Read the source file(s) being tested
   - Identify the key behaviors to verify
   - Check for existing tests to follow patterns
3. **Follow TDD workflow**:
   - Write the test FIRST
   - Make it fail (verify it fails for the right reason)
   - Implement/fix code to make it pass
   - Refactor if needed
4. **Apply correct patterns** based on what you're testing:
   - **Components**: Use React Testing Library, test user-visible behavior
   - **Hooks**: Use `renderHook` from RTL
   - **API/async**: Use MSW for mocking (`setupMSW()` from `tests/mocks/msw-utils`)
   - **Utilities**: Direct function testing

## Test file location

Mirror the source structure:
```
src/components/General/Avatar.tsx
    → tests/unit/components/General/Avatar.test.tsx

src/hooks/useDrag.tsx
    → tests/unit/hooks/useDrag.test.tsx

src/api/auth.api.ts
    → tests/unit/api/auth.api.test.ts
```

## Key conventions

- Use `~` imports (e.g., `import { Button } from "~/components/ds"`)
- Use `vi.fn()` for mocks, `vi.mock()` for module mocks
- Use `screen.getByRole`, `screen.getByText` over `getByTestId`
- Test behavior, not implementation
- Cover: happy path, error states, edge cases

## Key files to reference

- `TESTING.md` - Full testing guide with examples
- `tests/mocks/msw-utils.ts` - MSW setup utilities
- `tests/mocks/handlers.ts` - Existing mock handlers
- Existing tests in `tests/unit/` for patterns

## Run tests

```bash
bun run test:unit                           # Run all
bunx vitest run tests/unit/path/to/test.ts   # Run specific
bunx vitest tests/unit                       # Watch mode
```
