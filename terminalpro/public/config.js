/**
 * Runtime Configuration — Development Environment
 *
 * This file is loaded via a <script> tag in index.html BEFORE the app bundle,
 * so `window.__APP_CONFIG__` is available when the app initialises.
 *
 * These are NOT canonical defaults — they are values specific to the dev
 * environment (API keys, URLs, feature flags). Canonical defaults live in
 * `src/lib/runtimeConfigSchema.ts` (the Zod schema).
 *
 * For on-prem / self-hosted deployments, replace the values below (or mount a
 * volume over this file) to customise behaviour without rebuilding.
 *
 * For runtime builds (`vite build --mode runtime`), this file is auto-generated
 * from .env vars via the same Zod schema, so it's always in sync.
 */
window.__APP_CONFIG__ = {
  urls: {
    backend: "https://backend.openbb.dev",
    ai: "https://ai.openbb.dev",
    platform: "https://sdk.openbb.dev",
    database: "",
  },
  authentication: {
    allowEmailLogin: true,
    allowRegistration: true,
    allowForgotPassword: true,
    identityProviders: ["google"],
    sendMicrosoftIdToken: false,
    sendOktaIdToken: false,
    sendUserEmailAsHeader: false,
  },
  authProviders: {
    googleClientId: "508662717287-ls9frq1ohf1tvug8vm91ofhmbraiuegu.apps.googleusercontent.com",
    azureClientId: "287dfc81-c4ac-4093-b77d-8cd00d1c0a55",
    azureTenantId: "fd311a04-857a-46aa-82f3-52a928acad01",
    oktaClientId: "",
    oktaDomain: "",
  },
  copilot: {
    enabled: true,
    openbbCopilot: true,
    documentationLinks: true,
    webSearch: true,
    secFilings: false,
    jinaAi: true,
    aiEnhancements: true,
    saveSkillFromChat: false,
    showCustomKey: true,
  },
  ui: {
    showCompanionMode: false,
    showMinimizeWidget: true,
    showChartGeneration: true,
    showFeedbackButton: true,
    showInviteButton: true,
    showDemoRequestButton: true,
    showEnterpriseTags: true,
    showExternalDocLinks: true,
    showHelpDocumentation: true,
    showChangelog: true,
    showOnboardingQuestions: true,
    showTos: true,
    showCopilotSwitcher: true,
    showRemoveFromOrg: true,
    defaultTheme: "dark",
    odpDownloadInstaller: true,
    showSalesEmail: true,
    isLite: false,
    showMarketplace: true,
  },
  services: {
    posthog: true,
    hubspotForms: true,
    email: true,
    nixtla: true,
    cloudflareWorker: true,
  },
  data: {
    packageDataEnabled: true,
    allowedDataVendors: ["fmp", "benzinga", "econdb", "pyth", "tradingview"],
    allowedDbTypes: ["database", "snowflake", "databricks", "clickhouse"],
    openDataPlatformInstallerEnabled: true,
    allowHtmlJsExecution: false,
  },
  mcp: {
    defaultServerEnabled: true,
  },
  analytics: {
    posthogKey: "phc_qgW2kepNXdY7q1ZIuV2RT5WFXRDcTCkYlB66ukrOH30",
    posthogUrl: "https://info.openbb.dev",
  },
  whiteLabel: {
    name: "OpenBB Workspace",
    shortName: "OpenBB",
    loginImage: "/assets/images/openbb_lettering.svg",
    loginImageDark: "/assets/images/openbb_lettering_light.svg",
    leftSidebarLogo: "",
    leftSidebarLogoDark: "",
    favicon: "/favicon/favicon.ico",
    description: "OpenBB is the only open, AI-native workspace that unifies data, streamlines workflows, and delivers enterprise-grade collaboration and control for teams of all sizes.",
    keywords: "OpenBB Workspace, ai, finance, investment research, financial analysis, data visualization, teams, enterprise, collaborative platform, customizable research tools, financial technology, fintech, market insights",
    mainColor: "#0088CC",
    fontFamily: "Inter",
    showFloatingThemePreview: false,
  },
};
