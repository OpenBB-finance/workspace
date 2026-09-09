/**
 * Vitest Setup
 *
 * Global test configuration and mocks. Individual mock modules are organized
 * in tests/mocks/ for better maintainability.
 *
 * Mock files:
 * - jsdom-polyfills.ts  - Browser API polyfills (ResizeObserver, matchMedia, etc.)
 * - ag-grid.ts          - AG Grid component and hook mocks
 * - components.ts       - Common component mocks (Icon, etc.)
 * - contexts.ts         - React context mocks
 * - constants.ts        - Environment constants and feature flags
 * - api-client.ts       - Axios API client mock
 * - handlers.ts         - MSW request handlers
 * - server.ts           - MSW server setup
 * - msw-utils.ts        - MSW test utilities
 */
import "fake-indexeddb/auto";
import "vitest-canvas-mock";
import { afterEach, vi } from "vitest";
import "@testing-library/jest-dom";

// Import organized mock modules
import "./tests/mocks/jsdom-polyfills";
import "./tests/mocks/constants";
import "./tests/mocks/runtimeConfig";
import "./tests/mocks/components";
import "./tests/mocks/contexts";
import "./tests/mocks/ag-grid";
import "./tests/mocks/api-client";

// CSS modules mock
vi.mock("*.css", () => ({}));

afterEach(async () => {
  await vi.dynamicImportSettled()
})
