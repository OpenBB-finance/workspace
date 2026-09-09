/**
 * Runtime Configuration
 *
 * Provides app-wide configuration that can be swapped at deploy time without
 * rebuilding. In production / on-prem, `public/config.js` sets
 * `window.__APP_CONFIG__` before the bundle loads (synchronous <script> tag).
 * During local dev the same values are read from `VITE_*` env vars as a fallback.
 *
 * Usage: `import { getConfig } from "~/lib/runtimeConfig";`
 *
 * Module-scope calls like `const flag = getConfig().ui.showX` are fine — config.js
 * is a synchronous script that executes before any ES module code. Prefer a single
 * `getConfig()` call + destructuring when reading multiple values in the same scope.
 */
import {
  type LockedConfig,
  type RuntimeConfig,
  RuntimeConfigSchema,
} from "./runtimeConfigSchema";

export type { RuntimeConfig } from "./runtimeConfigSchema";
// Re-export schema utilities so existing imports keep working.
export { parseBool, parseStringArray } from "./runtimeConfigSchema";

declare global {
  interface Window {
    __APP_CONFIG__?: unknown;
  }
}

let _config: RuntimeConfig | null = null;

/**
 * Dev / on-prem fallback: reads VITE_* env vars and passes them through
 * RuntimeConfigSchema which handles coercion ("true" → true) and defaults.
 */
function buildConfigFromEnv(): RuntimeConfig {
  const e = import.meta.env;
  return RuntimeConfigSchema.parse({
    urls: {
      backend: e.VITE_PAYMENTS_URL,
      ai: e.VITE_AI_API_URL,
      platform: e.VITE_PLATFORM_URL,
      database: e.VITE_DATABASE_API_URL,
    },
    authentication: {
      allowEmailLogin: e.VITE_AUTHENTICATION_ALLOW_EMAIL_LOGIN,
      allowRegistration: e.VITE_AUTHENTICATION_ALLOW_REGISTRATION,
      allowForgotPassword: e.VITE_AUTHENTICATION_ALLOW_FORGOT_PASSWORD,
      identityProviders: e.VITE_AUTHENTICATION_IDENTITY_PROVIDERS,
      sendMicrosoftIdToken: e.VITE_AUTHENTICATION_SEND_MICROSOFT_IDTOKEN,
      sendOktaIdToken: e.VITE_AUTHENTICATION_SEND_OKTA_IDTOKEN,
      sendUserEmailAsHeader: e.VITE_AUTHENTICATION_SEND_USER_EMAIL_AS_HEADER,
    },
    authProviders: {
      googleClientId: e.VITE_GOOGLE_OAUTH_CLIENT_ID,
      azureClientId: e.VITE_AZURE_CLIENT_ID,
      azureTenantId: e.VITE_AZURE_TENANT_ID,
      oktaClientId: e.VITE_OKTA_CLIENT_ID,
      oktaDomain: e.VITE_OKTA_DOMAIN,
    },
    copilot: {
      enabled: e.VITE_AI_COPILOT_ENABLED,
      openbbCopilot: e.VITE_AI_COPILOT_OPENBB_COPILOT,
      documentationLinks: e.VITE_AI_COPILOT_DOCUMENTATION_LINKS,
      webSearch: e.VITE_AI_COPILOT_WEB_SEARCH,
      secFilings: e.VITE_AI_COPILOT_SEC_FILINGS,
      jinaAi: e.VITE_AI_COPILOT_JINA_AI,
      aiEnhancements: e.VITE_AI_COPILOT_AI_ENHANCEMENTS,
      saveSkillFromChat: e.VITE_AI_COPILOT_SAVE_SKILL_FROM_CHAT,
      showCustomKey: e.VITE_AI_SHOW_CUSTOM_COPILOT_KEY,
    },
    ui: {
      showCompanionMode: e.VITE_UI_SHOW_COMPANION_MCP_MODE,
      showMinimizeWidget: e.VITE_UI_SHOW_MINIMIZE_WIDGET,
      showChartGeneration: e.VITE_UI_SHOW_CHART_GENERATION,
      showFeedbackButton: e.VITE_UI_SHOW_FEEDBACK_BUTTON,
      showInviteButton: e.VITE_UI_SHOW_INVITE_BUTTON,
      showDemoRequestButton: e.VITE_UI_SHOW_DEMO_REQUEST_BUTTON,
      showEnterpriseTags: e.VITE_UI_SHOW_ENTERPRISE_TAGS,
      showExternalDocLinks: e.VITE_UI_SHOW_EXTERNAL_DOCUMENTATION_LINKS,
      showHelpDocumentation: e.VITE_UI_SHOW_HELP_DOCUMENTATION,
      showChangelog: e.VITE_UI_SHOW_CHANGELOG,
      showOnboardingQuestions: e.VITE_UI_SHOW_ONBOARDING_QUESTIONS,
      showTos: e.VITE_UI_SHOW_TOS,
      showCopilotSwitcher: e.VITE_UI_SHOW_COPILOT_SWITCHER,
      showRemoveFromOrg: e.VITE_UI_SHOW_REMOVE_FROM_ORG,
      defaultTheme: e.VITE_UI_DEFAULT_THEME,
      odpDownloadInstaller: e.VITE_UI_ODP_DOWNLOAD_INSTALLER,
      showSalesEmail: e.VITE_UI_SHOW_SALES_EMAIL,
      isLite: e.VITE_LITE,
      showMarketplace: e.VITE_UI_SHOW_MARKETPLACE,
    },
    services: {
      posthog: e.VITE_SERVICES_POSTHOG,
      hubspotForms: e.VITE_SERVICES_HUBSPOT_FORMS,
      email: e.VITE_SERVICES_EMAIL,
      nixtla: e.VITE_SERVICES_NIXTLA,
      cloudflareWorker: e.VITE_SERVICES_CLOUDFLARE_WORKER,
    },
    data: {
      packageDataEnabled: e.VITE_DATA_PACKAGE_DATA_ENABLED,
      allowedDataVendors: e.VITE_DATA_ALLOWED_DATA_VENDORS,
      allowedDbTypes: e.VITE_DATA_ALLOWED_DB_TYPES,
      openDataPlatformInstallerEnabled: e.VITE_OPEN_DATA_PLATFORM_INSTALLER_ENABLED,
      allowHtmlJsExecution: e.VITE_ALLOW_HTML_JS_EXECUTION,
    },
    mcp: {
      defaultServerEnabled: e.VITE_MCP_DEFAULT_SERVER_ENABLED,
    },
    analytics: {
      posthogKey: e.VITE_POSTHOG_KEY,
      posthogUrl: e.VITE_POSTHOG_URL,
    },
    whiteLabel: {
      name: e.VITE_WL_NAME,
      shortName: e.VITE_WL_SHORT_NAME,
      loginImage: e.VITE_WL_LOGIN_IMAGE,
      loginImageDark: e.VITE_WL_LOGIN_IMAGE_DARK,
      leftSidebarLogo: e.VITE_WL_LEFT_SIDEBAR_LOGO,
      leftSidebarLogoDark: e.VITE_WL_LEFT_SIDEBAR_LOGO_DARK,
      favicon: e.VITE_WL_FAVICON,
      description: e.VITE_WL_DESCRIPTION,
      keywords: e.VITE_WL_KEYWORDS,
      mainColor: e.VITE_WL_MAIN_COLOR,
      fontFamily: e.VITE_WL_FONT_FAMILY,
      showFloatingThemePreview: e.VITE_WL_SHOW_FLOATING_THEME_PREVIEW,
    },
  });
}

function applyLockedFields(config: RuntimeConfig): RuntimeConfig {
  const locked: LockedConfig =
    typeof __LOCKED_CONFIG__ !== "undefined" ? __LOCKED_CONFIG__ : {};
  const result = { ...config };
  for (const group of Object.keys(locked) as Array<keyof RuntimeConfig>) {
    if (locked[group]) {
      result[group] = {
        ...result[group],
        ...locked[group],
      } as RuntimeConfig[typeof group];
    }
  }
  return result;
}

function initConfig(): RuntimeConfig {
  let config: RuntimeConfig;

  if (typeof window !== "undefined" && window.__APP_CONFIG__) {
    const raw = window.__APP_CONFIG__;
    const result = RuntimeConfigSchema.safeParse(raw);
    if (result.success) {
      config = result.data;
    } else {
      console.error(
        "[runtimeConfig] window.__APP_CONFIG__ failed Zod validation. " +
          "Falling back to env vars (which may be empty in production). " +
          "Check that public/config.js matches the expected schema.",
      );
      console.error("[runtimeConfig] Raw config:", raw);
      console.error("[runtimeConfig] Validation errors:", result.error.format());
      config = buildConfigFromEnv();
    }
  } else {
    config = buildConfigFromEnv();
  }

  return applyLockedFields(config);
}

export function getConfig(): RuntimeConfig {
  if (!_config) {
    _config = initConfig();
    if (!_config.urls.backend)
      console.warn("[runtimeConfig] urls.backend is empty — API calls will fail");
    if (!_config.urls.ai)
      console.warn("[runtimeConfig] urls.ai is empty — AI/copilot features will fail");
    if (
      !_config.authProviders.googleClientId &&
      !_config.authProviders.azureClientId &&
      !_config.authProviders.oktaDomain &&
      !_config.authentication.allowEmailLogin
    ) {
      console.warn(
        "[runtimeConfig] No auth providers configured and email login is disabled — users will not be able to sign in",
      );
    }
  }
  return _config;
}

/** Reset cached config — only for use in tests. */
export function _resetConfig(): void {
  _config = null;
}
