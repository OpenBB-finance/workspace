# Testing Guide

This document outlines the testing strategy, conventions, and best practices for the OpenBB Workspace project.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [E2E Testing](#e2e-testing)
- [Mocking with MSW](#mocking-with-msw)
- [TDD Workflow](#tdd-workflow)
- [Coverage Requirements](#coverage-requirements)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Testing Philosophy

We follow a **Test-Driven Development (TDD)** approach for new features:

1. **Write the test first** - Define expected behavior before implementation
2. **Make it fail** - Verify the test fails for the right reason
3. **Make it pass** - Write minimal code to pass the test
4. **Refactor** - Clean up with the safety net of passing tests

### Testing Pyramid

```text
        /\
       /E2E\        <- Few, critical user journeys
      /------\
     /Integration\  <- API + component interactions
    /--------------\
   /   Unit Tests   \ <- Many, fast, isolated
  /------------------\
```

- **Unit tests**: Test individual functions, hooks, and components in isolation
- **Integration tests**: Test component interactions with mocked APIs (MSW)
- **E2E tests**: Test critical user flows in a real browser (Playwright)

---

## Test Structure

```text
tests/
├── unit/                    # Unit tests (Vitest)
│   ├── api/                 # API client function tests
│   ├── components/          # React component tests
│   │   ├── AI/
│   │   ├── AdminUsers/
│   │   ├── General/
│   │   └── ...
│   ├── hooks/               # Custom hook tests
│   ├── lib/utils/           # Utility function tests
│   └── routes/              # Route/page component tests
├── e2e/                     # End-to-end tests (Playwright)
│   ├── helpers.ts           # Shared E2E utilities
│   ├── mock_data/           # E2E mock data
│   └── *.spec.ts            # E2E test files
└── mocks/                   # MSW mock handlers
    ├── handlers.ts          # API request handlers
    ├── server.ts            # MSW server setup
    └── msw-utils.ts         # MSW test utilities
```

### File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Unit test | `{ComponentName}.test.tsx` | `Avatar.test.tsx` |
| Hook test | `{hookName}.test.ts` | `useDrag.test.ts` |
| Utility test | `{utilName}.test.ts` | `app.test.ts` |
| E2E test | `{feature}.spec.ts` | `auth.spec.ts` |

### Test Location

Tests should mirror the source structure:

```text
src/components/General/Avatar.tsx
    └── tests/unit/components/General/Avatar.test.tsx

src/hooks/useDrag.tsx
    └── tests/unit/hooks/useDrag.test.tsx

src/api/auth.api.ts
    └── tests/unit/api/auth.api.test.ts
```

---

## Running Tests

### Unit Tests

```bash
# Run all unit tests
bun run test:unit

# Run in watch mode (development)
bunx vitest tests/unit

# Run specific test file
bunx vitest run tests/unit/components/General/Avatar.test.tsx

# Run tests matching pattern
bunx vitest run -t "Avatar"

# Run with coverage report
bun run test:unit -- --coverage
```

### Integration Tests

```bash
bun run test:integration
```

### E2E Tests

```bash
# Run all E2E tests
bun run test:e2e

# Run with UI (interactive mode)
bunx playwright test tests/e2e --ui

# Run specific test file
bunx playwright test tests/e2e/auth.spec.ts

# Generate test code
bunx playwright codegen tests/e2e
```

> **Local Development**: Uncomment `export const proUrl = "http://localhost:1420";` in `/tests/e2e/helpers.ts` when running E2E tests locally.

### Storybook Accessibility Tests

We use `@storybook/test-runner` and `axe-playwright` to run accessibility (WCAG) checks against our UI components using Storybook.

```bash
# 1. Build the static Storybook (requires significant memory, hence NODE_OPTIONS)
bun run build-storybook

# 2. Start a local server for the static build
bunx http-server storybook-static -p 6006 -s &

# 3. Run the accessibility tests
bunx test-storybook --url http://127.0.0.1:6006
```

---

## Unit Testing

We use **Vitest** with **React Testing Library** for unit tests.

### Basic Component Test

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MyComponent from "~/components/MyComponent";

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent title="Hello" />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### Testing User Interactions

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("Button", () => {
  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole("button"));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Testing Hooks

```tsx
import { renderHook, act } from "@testing-library/react";
import { useCounter } from "~/hooks/useCounter";

describe("useCounter", () => {
  it("increments count", () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
```

### Testing with React Query

```tsx
import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { Mock, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

describe("DataComponent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows loading state", () => {
    (useQuery as Mock).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<DataComponent />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows data when loaded", () => {
    (useQuery as Mock).mockReturnValue({
      data: { name: "Test" },
      isLoading: false,
      isError: false,
    });

    render(<DataComponent />);

    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});
```

---

## Integration Testing

Integration tests verify components work correctly with mocked API responses.

### Using MSW for API Mocking

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { setupMSW, server, http, HttpResponse } from "@/tests/mocks/msw-utils";

describe("UserProfile", () => {
  setupMSW(); // Sets up MSW lifecycle (beforeAll, afterEach, afterAll)

  it("displays user data from API", async () => {
    // Override default handler for this test
    server.use(
      http.get("/api/user", () => {
        return HttpResponse.json({ name: "John Doe", email: "john@example.com" });
      })
    );

    render(<UserProfile />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });
  });

  it("handles API errors", async () => {
    server.use(
      http.get("/api/user", () => {
        return HttpResponse.json({ error: "Not found" }, { status: 404 });
      })
    );

    render(<UserProfile />);

    await waitFor(() => {
      expect(screen.getByText("Error loading user")).toBeInTheDocument();
    });
  });
});
```

---

## E2E Testing

We use **Playwright** for end-to-end tests that simulate real user behavior.

### Basic E2E Test

```typescript
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("user can create a dashboard", async ({ page }) => {
  await login(page);

  // Wait for app to load
  await page.waitForSelector("#tabs", { timeout: 30000 });

  // Create new dashboard
  await page.click('[data-testid="new-dashboard-button"]');
  await page.fill('[data-testid="dashboard-name-input"]', "My Dashboard");
  await page.click('[data-testid="create-dashboard-submit"]');

  // Verify dashboard was created
  await expect(page.getByText("My Dashboard")).toBeVisible();
});
```

### E2E Helper Functions

Located in `tests/e2e/helpers.ts`:

- `login(page)` - Authenticate user
- `onboardUser(page)` - Complete onboarding flow
- `acceptTermsAndConditions(page)` - Accept TOS
- `dismissChangeLog(page)` - Dismiss changelog modal
- `handleFirstTime(page)` - Handle first-time user setup

### When to Write E2E Tests

Write E2E tests for:

- Critical user journeys (login, dashboard creation, data viewing)
- Flows that span multiple pages
- Features with complex browser interactions (drag-drop, charting)

Do NOT write E2E tests for:

- Individual component behavior (use unit tests)
- API response handling (use integration tests)
- Edge cases and error states (use unit/integration tests)

---

## Mocking with MSW

Mock Service Worker (MSW) intercepts network requests for realistic API mocking. Our MSW setup provides comprehensive handlers for all API endpoints.

### MSW File Structure

```text
tests/mocks/
├── handlers.ts      # API request handlers (organized by domain)
├── server.ts        # MSW server setup
└── msw-utils.ts     # Test utilities and setup helpers
```

### Available Mock Data

Located in `tests/mocks/handlers.ts`:

```typescript
import {
  mockUser,
  mockValidateResponse,
  mockDashboardData,
  mockUsage,
  mockFeatureFlags,
} from "~/tests/mocks/handlers";
```

| Mock Object | Description |
|-------------|-------------|
| `mockUser` | Default authenticated user object |
| `mockValidateResponse` | Token validation response |
| `mockDashboardData` | Dashboard sync response (owned/shared) |
| `mockUsage` | Usage limits and current usage |
| `mockFeatureFlags` | Feature tier and enabled features |

### Handler Organization

The `handlers.ts` file is organized by API domain:

```typescript
// ============ Auth Endpoints ============
http.post(`${BASE_URL}/pro/login`, ...)
http.get(`${BASE_URL}/pro/validate`, ...)
http.post(`${BASE_URL}/pro/logout`, ...)

// ============ Dashboard Endpoints ============
http.get(`${BASE_URL}/pro/dash/sync`, ...)
http.post(`${BASE_URL}/pro/dash/sync`, ...)

// ============ Usage & Tier Endpoints ============
http.get(`${BASE_URL}/pro/usage`, ...)

// ============ Data Connector Endpoints ============
http.get(`${BASE_URL}/pro/data-connectors/api-source`, ...)

// ============ Copilot Endpoints ============
http.get(`${BASE_URL}/pro/copilot-chats`, ...)

// ============ Passthrough Handlers ============
http.all("https://test-backend.com/*", () => passthrough())
```

### Creating Custom Handlers

```typescript
import { http, HttpResponse } from "msw";

// Success handler
export const customHandler = http.get("/api/custom", () => {
  return HttpResponse.json({ data: "value" });
});

// Error handler
export const errorHandler = http.get("/api/custom", () => {
  return HttpResponse.json({ error: "Failed" }, { status: 500 });
});

// Use in tests
server.use(customHandler);
```

### Handler Patterns

**1. Conditional responses based on request body:**

```typescript
http.post(`${BASE_URL}/pro/login`, async ({ request }) => {
  const body = await request.json();

  if (body.email === "invalid@example.com") {
    return HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 });
  }

  if (body.email === "2fa@example.com") {
    return HttpResponse.json({ requires_2fa: true }, { status: 200 });
  }

  return HttpResponse.json({ ...mockUser, status: 200 });
});
```

**2. Conditional responses based on auth header:**

```typescript
http.get(`${BASE_URL}/pro/validate`, ({ request }) => {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || authHeader === "Bearer invalid-token") {
    return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  return HttpResponse.json(mockValidateResponse);
});
```

**3. Dynamic route parameters:**

```typescript
http.get(`${BASE_URL}/pro/files/:fileUuid/presigned-url`, ({ params }) => {
  const { fileUuid } = params;
  return HttpResponse.json({
    pre_signed_url: `https://storage.example.com/${fileUuid}`,
    stored_file_uuid: fileUuid,
  });
});
```

**4. Passthrough for test-specific URLs:**

```typescript
// Allow vi.fn() mocked URLs to pass through MSW
http.all("https://test-backend.com/*", () => passthrough()),
http.all("http://localhost/*", () => passthrough()),
```

### Handler Utilities

```typescript
import { createMockHandler, createErrorHandler } from "~/tests/mocks/handlers";

// Quick success response
const handler = createMockHandler("get", "/pro/data", { items: [] });

// Quick error response
const errorHandler = createErrorHandler("get", "/pro/data", "Server error", 500);
```

### Overriding Handlers in Tests

```typescript
import { server, http, HttpResponse } from "~/tests/mocks/msw-utils";

describe("MyComponent", () => {
  setupMSW();

  it("handles API error", async () => {
    // Override default handler for this test only
    server.use(
      http.get(`${BASE_URL}/pro/usage`, () => {
        return HttpResponse.json({ detail: "Rate limited" }, { status: 429 });
      })
    );

    render(<MyComponent />);
    // Test error handling...
  });
});
```

### Adding New Handlers

When adding new API endpoints:

1. Add the handler to the appropriate section in `handlers.ts`
2. Follow the existing naming pattern: `http.{method}(\`${BASE_URL}/pro/{endpoint}\`, ...)`
3. Include error scenarios for common cases (401, 404, 500)
4. Add mock data constants if needed for reuse
5. Document any special behavior in comments

---

## TDD Workflow

### For New Features

1. **Write E2E test** (if user-facing feature):

   ```typescript
   test("user can export dashboard to PDF", async ({ page }) => {
     // This will fail - feature doesn't exist
     await page.click('[data-testid="export-pdf-button"]');
     await expect(page.getByText("PDF exported")).toBeVisible();
   });
   ```

2. **Write integration test** for component:

   ```typescript
   describe("ExportButton", () => {
     setupMSW();

     it("calls export API when clicked", async () => {
       // This will fail - component doesn't exist
       render(<ExportButton dashboardId="123" />);
       await userEvent.click(screen.getByRole("button"));
       // Assert API was called
     });
   });
   ```

3. **Write unit tests** for utilities/hooks:

   ```typescript
   describe("useExport", () => {
     it("returns export function", () => {
       // This will fail - hook doesn't exist
       const { result } = renderHook(() => useExport());
       expect(result.current.exportToPDF).toBeDefined();
     });
   });
   ```

4. **Implement** code to make tests pass

5. **Refactor** with confidence

### For Bug Fixes

1. **Write a test that reproduces the bug**
2. **Verify the test fails**
3. **Fix the bug**
4. **Verify the test passes**
5. **Commit both the test and fix together**

---

## Coverage Requirements

### Current Thresholds

```typescript
// vite.config.ts
coverage: {
  thresholds: {
    lines: 20,
    functions: 20,
    branches: 15,
    statements: 20,
  }
}
```

### Target Coverage by Area

| Area | Current | Target |
|------|---------|--------|
| API modules | 88% | 90%+ |
| Hooks | 55% | 80%+ |
| Utils/Lib | 49% | 80%+ |
| Components | 8% | 60%+ |
| Routes | ~2% | 50%+ |

### New Code Requirements

- **All new code must have tests**
- **Minimum 80% coverage for new files**
- **Critical paths require 100% coverage** (auth, payments, data handling)

---

## Common Patterns

### Testing Components with Providers

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Usage
render(<MyComponent />, { wrapper: createWrapper() });
```

### Testing Async Components

```tsx
import { waitFor, screen } from "@testing-library/react";

it("loads and displays data", async () => {
  render(<AsyncComponent />);

  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Assert on loaded content
  expect(screen.getByText("Data loaded")).toBeInTheDocument();
});
```

### Testing Error Boundaries

```tsx
it("displays error fallback on error", () => {
  const ThrowError = () => {
    throw new Error("Test error");
  };

  render(
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
});
```

### Testing Portal Components

Portal components (modals, tooltips, dropdowns) render outside the React tree. Test them in isolation:

```tsx
describe("Modal", () => {
  it("renders content in portal", () => {
    render(<Modal isOpen={true}>Modal content</Modal>);

    // Content is in document but not in container
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });
});
```

---

## Troubleshooting

### Common Issues

**"Cannot find module" errors.**

- Ensure path aliases are configured in `vitest.setup.ts`
- Check that the import path matches the alias in `vite.config.ts`

**"ResizeObserver is not defined".**

- Already polyfilled in `vitest.setup.ts`
- If still failing, check test is using the setup file

**"Canvas is not defined".**

- Already mocked via `vitest-canvas-mock`
- For charting tests, may need additional mocking

**MSW not intercepting requests.**

- Ensure `setupMSW()` is called inside `describe` block
- Check request URL matches handler exactly
- Verify handler is using correct HTTP method

**Flaky async tests.**

- Use `waitFor` instead of arbitrary timeouts
- Ensure proper cleanup between tests
- Check for race conditions in state updates

### Debugging Tips

```tsx
// Print current DOM
screen.debug();

// Print specific element
screen.debug(screen.getByRole("button"));

// Log what queries are available
screen.logTestingPlaygroundURL();
```

### Getting Help

1. Check existing tests for similar patterns
2. Review React Testing Library docs: <https://testing-library.com/docs/react-testing-library/intro>
3. Check Vitest docs: <https://vitest.dev/>
4. Ask in team Slack channel
