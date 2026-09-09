import packageJson from "../package.json";

const {
  VITE_ADDIN_BASE_URL,
  VITE_BACKEND_URL,
  VITE_HELP_URL,
  VITE_PLATFORM_URL,
  VITE_POSTHOG_API_KEY,
  VITE_POSTHOG_API_HOST,
  VITE_ENV,
} = import.meta.env;

const VERSION = `1.${packageJson.version}`;
const OPENBB_SANDBOX_ID = "40a4d297-6729-49b5-af35-c0244536c429";

const ADDIN_FUNCS_SUFFIX = VITE_ADDIN_BASE_URL?.includes("localhost")
  ? "LOCAL."
  : VITE_ADDIN_BASE_URL?.includes(".dev")
  ? "DEV."
  : "";

export {
  ADDIN_FUNCS_SUFFIX,
  OPENBB_SANDBOX_ID,
  VERSION,
  VITE_ADDIN_BASE_URL,
  VITE_BACKEND_URL,
  VITE_ENV,
  VITE_HELP_URL,
  VITE_PLATFORM_URL,
  VITE_POSTHOG_API_HOST,
  VITE_POSTHOG_API_KEY,
};
