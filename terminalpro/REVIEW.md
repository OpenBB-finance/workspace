# Code Review Guidelines

This document outlines what to look for when reviewing pull requests for the OpenBB Workspace project.

> **Product + Architecture Context:** OpenBB Workspace is the browser dashboard and Copilot UI for our financial data platform. The frontend routes requests either to the Workspace Core API (auth, storage, sharing) or to Copilot, and users bring their own data via backend connectors that power widgets and LLM tools. Start every review with that flow in mind and refer to [docs/product-context.md](docs/product-context.md) for the detailed overview.

## Review Philosophy

- **Be constructive, not critical** - Suggest improvements, don't just point out flaws
- **Assume good intent** - The author made decisions for reasons; ask before assuming they're wrong
- **Focus on what matters** - Don't nitpick formatting if Biome handles it
- **Review the code, not the person** - "This function could be simplified" not "You wrote this wrong"
- **DONT BE A YES MAN** - We need to make sure the code is good and follows the guidelines

---

## Review Checklist

### 1. Tests

> **This is the most important section.** We follow TDD - tests are not optional.

- [ ] **New code has tests** - All new functions, components, and hooks must have tests
- [ ] **Tests are meaningful** - Not just coverage padding; they test actual behavior
- [ ] **Tests cover edge cases** - Empty states, error states, boundary conditions
- [ ] **Tests follow patterns** - Consistent with existing test structure (see [TESTING.md](./TESTING.md))
- [ ] **No skipped tests** - `.skip` or `.only` should not be committed
- [ ] **Tests pass locally** - Author should confirm tests pass before requesting review

**Red flags:**
```typescript
// Bad: Testing implementation, not behavior
expect(component.state.isLoading).toBe(true);

// Good: Testing what user sees
expect(screen.getByText("Loading...")).toBeInTheDocument();
```

```typescript
// Bad: No assertions
it("renders component", () => {
  render(<MyComponent />);
});

// Good: Meaningful assertion
it("renders user name", () => {
  render(<MyComponent user={{ name: "John" }} />);
  expect(screen.getByText("John")).toBeInTheDocument();
});
```

---

### 2. Code Quality

#### Readability

- [ ] **Code is self-documenting** - Variable/function names explain what they do
- [ ] **No unnecessary comments** - Comments explain "why", not "what"
- [ ] **Functions are focused** - Each function does one thing
- [ ] **No magic numbers/strings** - Use constants with meaningful names
- [ ] **Complex functions have JSDoc** - Non-trivial functions (async flows, state mutations, imperative store access) should have a short `/** ... */` description explaining purpose, assumptions, and any non-obvious design decisions (e.g., why `getState()` is used instead of reactive hooks)

```typescript
// Bad
if (user.role === 3) { ... }

// Good
if (user.role === UserRole.Admin) { ... }
```

#### Complexity

- [ ] **No over-engineering** - Solve the problem at hand, not hypothetical future problems
- [ ] **No premature abstraction** - Three similar lines are often better than a premature helper
- [ ] **Appropriate error handling** - Handle errors at system boundaries, trust internal code

```typescript
// Bad: Over-engineered for simple use case
const ButtonFactory = createButtonFactory({
  variants: ["primary", "secondary"],
  sizes: ["sm", "md", "lg"],
  // ... 50 more config options
});

// Good: Simple component that does what's needed
const Button = ({ variant = "primary", children }) => (
  <button className={styles[variant]}>{children}</button>
);
```

#### DRY vs WET

- [ ] **Appropriate duplication** - Some duplication is OK; bad abstractions are worse
- [ ] **Shared logic is truly shared** - If extracting, ensure it's used in 3+ places

---

### System Impact

- [ ] **Consider downstream effects**: shared hooks/utilities, API contracts, feature flags, config, analytics
- [ ] Look for likely regressions in adjacent surfaces (routing, auth, theming, permissions, caching)
- [ ] **Confirm observability/rollout**: logs/metrics/feature-flag strategy if behavior changes
- [ ] Ask “what else could this impact?” and note any follow-ups or regression tests needed

### 3. TypeScript

- [ ] **No `any` types** - If unavoidable, add comment explaining why
- [ ] **Proper type narrowing** - Use type guards, not type assertions
- [ ] **Interfaces over types** for object shapes (unless union/intersection needed)
- [ ] **No unnecessary type annotations** - Let TypeScript infer when possible

```typescript
// Bad
const name: string = "John"; // TypeScript infers this

// Good
const name = "John";

// Good: Type needed for function params
const greet = (name: string): string => `Hello, ${name}`;
```

```typescript
// Bad: Type assertion
const user = data as User;

// Good: Type guard
if (isUser(data)) {
  // data is now typed as User
}
```

---

### 4. React Patterns

#### Component Design

- [ ] **Single responsibility** - Component does one thing well
- [ ] **Props are minimal** - Only pass what's needed
- [ ] **No prop drilling** - Use context or composition for deep props
- [ ] **Proper key usage** - Keys are stable and unique (not array index for dynamic lists)

#### Hooks

- [ ] **Rules of hooks followed** - No conditional hooks, proper dependency arrays
- [ ] **Custom hooks are reusable** - If single-use, consider keeping logic in component
- [ ] **Dependency arrays are complete** - ESLint should catch this, but verify
- [ ] **Consolidate multiple useState** - If 3+ related `useState` calls, use `useStateReducer` instead

```typescript
// Bad: Missing dependency
useEffect(() => {
  fetchData(userId);
}, []); // userId missing from deps

// Good
useEffect(() => {
  fetchData(userId);
}, [userId]);
```

Also, dont use `useEffect` for fetching data, use tanstack query instead.

```typescript
// Bad: Too many related useState calls - multiple re-renders on sync
const [refreshEnabled, setRefreshEnabled] = useState(initialSettings.refreshEnabled);
const [refreshRate, setRefreshRate] = useState(initialSettings.refreshRate);

useEffect(() => {
  if (open) {
    const settings = widget.storage?.refreshData ?? DEFAULT_SETTINGS;
    setRefreshEnabled(settings.refreshEnabled); // re-render 1
    setRefreshRate(settings.refreshRate);       // re-render 2
  }
}, [open, widget.storage?.refreshData]);

// Good: Consolidate with useStateReducer - single dispatch, single re-render
import { useStateReducer } from "~/hooks/useStateReducer";

const [state, dispatch] = useStateReducer(
  widget.storage?.refreshData ?? DEFAULT_SETTINGS
);

useEffect(() => {
  if (open) {
    const settings = widget.storage?.refreshData ?? DEFAULT_SETTINGS;
    dispatch(settings); // single re-render, batch update
  }
}, [open, widget.storage?.refreshData]);
```

#### Performance

> **Performance is critical.** These patterns cause real render cascades. Violations are **Blocking**.

##### Memoization Requirements

- [ ] **Derived state uses `useMemo`** - Any value computed from props/state
- [ ] **Callbacks use `useCallback`** - Functions passed to children or in dependency arrays
- [ ] **Hook inputs are stable** - Objects/arrays passed to custom hooks must be memoized
- [ ] **No inline objects/arrays in JSX** - Creates new ref every render

##### Data Iteration

- [ ] **Single-pass iteration** - Don't chain `.filter()`, `.map()`, `.find()` separately on same array
- [ ] **Memoize derived arrays** - Wrap filtered/mapped data with `useMemo`

##### Virtualization

- [ ] **Large lists are virtualized** - 100+ items should use virtualization

**Red flags:**

```typescript
// Bad: Unmemoized hook input - creates new object every render
function Component({ userId, teamId }) {
  const data = useCustomHook({ userId, teamId }); // ❌ new ref each render
}

// Good: Stable hook input
function Component({ userId, teamId }) {
  const options = useMemo(() => ({ userId, teamId }), [userId, teamId]);
  const data = useCustomHook(options); // ✅ stable ref
}
```

```typescript
// Bad: Derived state without useMemo
function Component({ items }) {
  const filtered = items.filter(x => x.active); // ❌ recalculated every render
  return <List items={filtered} />;
}

// Good: Memoized derived state
function Component({ items }) {
  const filtered = useMemo(() => items.filter(x => x.active), [items]);
  return <List items={filtered} />;
}
```

```typescript
// Bad: Multiple iterations on same array
const active = items.filter(x => x.active);
const sorted = active.sort((a, b) => a.name.localeCompare(b.name));
const mapped = sorted.map(x => ({ ...x, display: x.name }));

// Good: Single-pass iteration
const processed = useMemo(() =>
  items
    .reduce((acc, x) => {
      if (x.active) acc.push({ ...x, display: x.name });
      return acc;
    }, [])
    .sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);
```

```typescript
// Bad: Inline callback causes child re-renders
<Button onClick={() => handleClick(id)} /> // ❌ new function every render

// Good: Memoized callback
const handleButtonClick = useCallback(() => handleClick(id), [id]);
<Button onClick={handleButtonClick} /> // ✅ stable ref
```

##### When NOT to Memoize

- Primitive values (strings, numbers, booleans)
- Already stable refs (`useRef`, module-level constants)
- Trivial property access (e.g., `props.user.name`)

---

### 5. API & Data Handling

- [ ] **Error states handled** - What happens when API fails?
- [ ] **Loading states handled** - User sees feedback during async operations
- [ ] **Empty states handled** - What if there's no data?
- [ ] **Race conditions considered** - Stale closures, cancelled requests

```typescript
// Good: Handles all states
const { data, isLoading, error } = useQuery({ ... });

if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
if (!data?.length) return <EmptyState />;
return <DataList data={data} />;
```

---

### 6. Security

- [ ] **No secrets in code** - This is a client-side app; `.env` vars are bundled into the build and publicly visible. Actual secrets (API keys with billing, auth tokens) must live in the backend.
- [ ] **User input is sanitized** - Especially for dynamic content rendering (use DOMPurify via `sanitizeHtml` from `~/lib/utils/sanitize`)
- [ ] **No XSS vulnerabilities** - Be careful with `dangerouslySetInnerHTML`. For external images/remote content, render inside an iframe (see `HtmlViewer` component)
- [ ] **External data sources treated as untrusted** - Content from RSS/Atom feeds, third-party APIs, user-provided URLs, or any external source must be sanitized before rendering. Use `sanitizeHtml()` + sandboxed iframes for HTML content.
- [ ] **Auth checks in place** - Protected routes/actions verify permissions
- [ ] **External resources** - Be cautious loading external scripts/stylesheets that could be compromised

```typescript
// Bad: XSS vulnerability - rendering external content directly
<div dangerouslySetInnerHTML={{ __html: userInput }} />
{parse(feedItem.description)} // html-react-parser on untrusted content

// Good: Use sanitization library if HTML needed
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />

// Best: Avoid dangerouslySetInnerHTML when possible
<div>{userInput}</div>

// Even better: render untrusted content inside a sandboxed iframe (see HtmlViewer)
// Use sandbox="" (empty) for maximum restriction, or add specific permissions as needed
<iframe
  srcDoc={sanitizeHtml(untrustedHtml)}
  sandbox=""
  className="w-full h-full border-0"
/>
```

**Common sources of untrusted content to watch for:**
- RSS/Atom feed descriptions and content
- Third-party API responses rendered as HTML
- User-provided URLs or embed codes
- Markdown/HTML from external sources
- AI-generated content (use `Artifact` component patterns)

---

### 7. Styling

- [ ] **Tailwind classes used** - No inline styles unless dynamic values required
- [ ] **Semantic tokens used** - Use theme-aware tokens (`bg-general-bg-primary`, `text-ds-text-heading`, etc.) instead of primitive `dark:` pairs. Violations are **Blocking**.
- [ ] **Responsive design considered** - Mobile breakpoints if user-facing
- [ ] **Accessibility basics** - Proper semantic HTML, aria labels where needed

#### Semantic Color Tokens (Blocking)

> All new/changed UI code **must** use semantic tokens from `src/styles/tokens.css`. These auto-switch between light/dark mode and eliminate `dark:` prefixes. Using primitive color pairs (`bg-white dark:bg-dark-900`) when a semantic token exists is a **Blocking** issue.

**Token cheat-sheet (most common):**

| Purpose | Semantic token | ❌ Primitive equivalent |
|---|---|---|
| Page/card background | `bg-general-bg-primary` | `bg-white dark:bg-dark-900` |
| Secondary background | `bg-general-bg-secondary` | `bg-light-100 dark:bg-dark-800` |
| Hover background | `hover:bg-general-bg-primary-hover` | `hover:bg-light-200 dark:hover:bg-dark-500` |
| Primary border | `border-general-border-primary` | `border-light-300 dark:border-dark-600` |
| Subtle border | `border-general-border-secondary` | `border-light-200 dark:border-dark-800` |
| Heading text | `text-ds-text-heading` | `text-light-900 dark:text-white` |
| Body text / icons | `text-ds-text-body` | `text-light-600 dark:text-light-100` |
| Caption / placeholder | `text-ds-text-caption` | `text-light-500 dark:text-dark-300` |
| Divider | `border-surface-divider` | `border-light-200 dark:border-dark-750` |
| Card surface | `bg-surface-card` | `bg-white dark:bg-dark-900` |

**When `dark:` is acceptable:**
- Status indicator dots that need distinct shades per theme (e.g., disconnected state)
- Forced-light contexts (login, onboarding) where semantic tokens break — use static primitives instead

```typescript
// Bad: Primitive pair — breaks design system consistency
<div className="border-light-200 dark:border-dark-800 bg-white dark:bg-dark-900" />
<span className="text-light-600 dark:text-light-100" />

// Good: Semantic tokens — auto dark mode, no `dark:` needed
<div className="border-general-border-secondary bg-general-bg-primary" />
<span className="text-ds-text-body" />
```

See `src/styles/tokens.css` for the full token list and `.claude/skills/openbb-design/SKILL.md` for the complete color system reference.

```typescript
// Bad
<div style={{ marginTop: 16, color: "red" }}>Error</div>

// Good
<div className="mt-4 text-red-500">Error</div>

// OK: Dynamic value requires inline style
<div style={{ width: `${percentage}%` }} className="bg-blue-500" />
```

---

### 8. File Organization

- [ ] **Correct location** - File is in appropriate directory per project structure
- [ ] **Test file exists** - Corresponding test file in `tests/unit/`
- [ ] **Imports use alias** - `~/` instead of relative paths
- [ ] **No circular dependencies** - Check for import cycles

---

### 9. UI Components/Hooks

- [ ] **No repetition** - Verify if a component already exists in our design system `src/components/ds` or `src/components/ui` (same for hooks). We should use those instead of creating new ones.

---

### 10. Configuration & Environment Variables

> All runtime config flows through a **Zod-validated schema** (`runtimeConfigSchema.ts`). Violations are **Blocking** — partial wiring silently breaks runtime/on-prem builds.

- [ ] **Never read `import.meta.env.VITE_*` directly** - All config access goes through `getConfig()`. Direct env reads bypass validation and break runtime builds.
- [ ] **New config fields wired in all 5 places**:
  1. `src/lib/runtimeConfigSchema.ts` — Zod schema field with default (single source of truth for defaults)
  2. `src/lib/runtimeConfig.ts` — `buildConfigFromEnv()` mapping
  3. `vite.config.ts` — `generateRuntimeConfigPlugin` mapping
  4. `public/config.js` — dev value
  5. `tests/mocks/runtimeConfig.ts` — `mockConfig` entry
- [ ] **`getConfig()` never called at module scope** — Only inside function bodies (component render, effects, handlers). Module-level calls create stale closures.
- [ ] **Defaults only in the Zod schema** — No scattered fallbacks in components or utilities.
- [ ] **Tests use `mockConfig` mutations** — Not `vi.stubEnv("VITE_*")`. Mutate `mockConfig` directly in tests.
- [ ] **Build-time-only vars stay build-time** — Vars like `VITE_RELEASE_VERSION`, `VITE_SNOWFLAKE_NATIVE_APP` are compile-time constants and should NOT be added to the runtime schema.

```typescript
// Bad: Direct env read in component
const apiUrl = import.meta.env.VITE_API_URL;

// Good: Through getConfig()
const { apiUrl } = getConfig().urls;
```

```typescript
// Bad: Module-scope call — stale closure
const config = getConfig(); // ❌ runs once at import time
export function doSomething() {
  return config.urls.apiUrl;
}

// Good: Called inside function body
export function doSomething() {
  const config = getConfig(); // ✅ fresh on each call
  return config.urls.apiUrl;
}
```

```typescript
// Bad: Testing with vi.stubEnv
vi.stubEnv("VITE_SHOW_FEEDBACK_BUTTON", "true");

// Good: Testing with mockConfig
import { mockConfig } from "tests/mocks/runtimeConfig";
mockConfig.ui.showFeedbackButton = true;
```

---

## PR Description Checklist

The PR description should include:

- [ ] **Summary** - What does this PR do?
- [ ] **Why** - What problem does it solve?
- [ ] **How to test** - Steps to verify the change works
- [ ] **Screenshots** - If UI changes, before/after screenshots
- [ ] **Breaking changes** - If any, how to migrate

---

## When to Request Changes vs Approve

### Request Changes

- Tests are missing or inadequate
- Security vulnerability present
- Breaking change without migration path
- Code doesn't work as described
- Major performance issue

### Approve with Comments

- Minor style preferences
- Suggestions for future improvements
- Questions about design decisions (non-blocking)
- Nitpicks that don't affect functionality

### Approve

- Code works as described
- Tests are adequate
- Follows project conventions
- No security concerns

---

## Review Response Etiquette

### As a Reviewer

- Differentiate between blocking issues and suggestions
- Prefix non-blocking comments with "nit:" or "suggestion:"
- Explain the "why" behind requested changes
- Offer solutions, not just problems
- Respond promptly to author's questions

### As an Author

- Don't take feedback personally
- Explain your reasoning if you disagree
- Ask for clarification if feedback is unclear
- Address all comments before re-requesting review
- Thank reviewers for their time

---

## Common Review Comments (Copy-Paste)

### Missing Tests
```
This new function/component needs tests. Please add unit tests covering:
- Happy path
- Error cases
- Edge cases (empty input, null values, etc.)

See TESTING.md for patterns.
```

### Over-Engineering
```
This seems more complex than necessary for the current requirements.
Could we simplify to just handle the current use case? We can always
extend later if needed (YAGNI principle).
```

### Missing Error Handling
```
What happens if this API call fails? Please add error handling and
show appropriate feedback to the user.
```

### Type Safety
```
Using `any` here bypasses TypeScript's protections. Could we:
1. Define a proper type/interface, or
2. Use `unknown` with type guards?
```

### Test Quality
```
This test doesn't have meaningful assertions. It passes even if
the component is completely broken. Please add assertions that
verify the actual behavior.
```
