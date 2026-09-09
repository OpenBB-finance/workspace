/**
 * Constants Mocks
 *
 * Mocks for environment-dependent constants and configuration.
 * These ensure tests run with predictable values regardless of environment.
 */
import { vi } from "vitest";

// ~/lib/constants - environment-dependent values
vi.mock("~/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/constants")>();
  return {
    ...actual,
    VERSION: "test-version",
    inSnowflakeNativeApp: false,
  };
});

// onPremFeatureFlags - feature flag configuration
vi.mock("~/lib/onPremFeatureFlags", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/lib/onPremFeatureFlags")>();
  return {
    ...actual,
    getShowDemoRequestButton: () => true,
  };
});
