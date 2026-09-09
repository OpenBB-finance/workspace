/**
 * Component Mocks
 *
 * Mocks for commonly used components that have external dependencies
 * or complex rendering logic not needed in most tests.
 */
import { vi } from "vitest";

// Icon component - depends on VERSION constant and SVG sprite loading
vi.mock("~/components/Icon", () => ({
  default: vi.fn(({ id, className }) => {
    const React = require("react");
    return React.createElement("svg", {
      "data-testid": `icon-${id}`,
      className,
    });
  }),
}));

// SnowflakeHide - reads VITE_SNOWFLAKE_NATIVE_APP at module level;
// default to showing children (non-snowflake mode) in tests
vi.mock("~/components/General/SnowflakeHide", () => ({
  default: vi.fn(({ children }) => {
    const React = require("react");
    return React.createElement(React.Fragment, null, children);
  }),
}));
