import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { loadEnv, type PluginOption } from "vite";
import { Mode, plugin as mdPlugin } from "vite-plugin-markdown";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";
import webfontDownload from "vite-plugin-webfont-dl";
import { defineConfig } from "vitest/config";
import {
  buildLockedConfig,
  type LockedConfig,
  RuntimeConfigSchema,
} from "./src/lib/runtimeConfigSchema.ts";

// plugin so it always forces reload because hmr breaks the dev app
const fullReloadAlways: PluginOption = {
  name: "full-reload-always",
  handleHotUpdate({ server }) {
    server.ws.send({ type: "full-reload" });
    return [];
  },
} as PluginOption;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ""); // we need to do this so we can use the env variables in the config

  const APP_NAME = env.VITE_WL_NAME;
  const APP_DESCRIPTION = env.VITE_WL_DESCRIPTION;
  const APP_SHORT_NAME = env.VITE_WL_SHORT_NAME;
  const IS_SNOWFLAKE = env.VITE_SNOWFLAKE_NATIVE_APP === "true";
  const isTradingViewEnabled = env.VITE_TRADINGVIEW_ENABLED === "true";

  // ── Build the locked-config overlay from the deployment's policy ──
  // Two ways to supply the policy (which fields are locked, to what values):
  //   - VITE_LOCKED_CONFIG_PROFILE: names a strict, in-repo profile in
  //     config-profiles/ (e.g. "lite" → config-profiles/lite.locked.json).
  //     Strict profiles must triage every schema field — see buildLockedConfig.
  //   - VITE_LOCKED_CONFIG_FILE: a bespoke JSON file the deployment owns
  //     (on-prem / customer images), typically non-strict.
  // Absent → nothing is locked, which is the default for the standard build,
  // on-prem, and free-tier. buildLockedConfig validates the JSON against
  // RuntimeConfigSchema, so only known, correctly-typed fields survive.
  let lockedConfig: LockedConfig = {};
  const lockedConfigFile = env.VITE_LOCKED_CONFIG_FILE;
  const lockedConfigProfile = env.VITE_LOCKED_CONFIG_PROFILE;
  if (lockedConfigFile && lockedConfigProfile) {
    throw new Error(
      "Set either VITE_LOCKED_CONFIG_PROFILE or VITE_LOCKED_CONFIG_FILE, not both",
    );
  }
  const lockedPolicyPath = lockedConfigProfile
    ? path.resolve(
        import.meta.dirname,
        "config-profiles",
        `${lockedConfigProfile}.locked.json`,
      )
    : lockedConfigFile
      ? path.resolve(process.cwd(), lockedConfigFile)
      : undefined;
  if (lockedPolicyPath) {
    if (!existsSync(lockedPolicyPath)) {
      const source = lockedConfigProfile
        ? `VITE_LOCKED_CONFIG_PROFILE is set to "${lockedConfigProfile}"`
        : `VITE_LOCKED_CONFIG_FILE is set to "${lockedConfigFile}"`;
      throw new Error(`${source} but no file exists at ${lockedPolicyPath}`);
    }
    lockedConfig = buildLockedConfig(
      JSON.parse(readFileSync(lockedPolicyPath, "utf-8")),
    );

    const lockedPaths = Object.entries(lockedConfig).flatMap(([group, fields]) =>
      Object.keys(fields ?? {}).map((field) => `${group}.${field}`),
    );
    console.log(
      `[locked-config] locking ${lockedPaths.length} field(s): ${lockedPaths.join(", ")}`,
    );
  }

  // Strip <script src="/config.js"> for non-runtime builds (standard build + dev).
  // In runtime mode the tag is kept so on-prem deployments load window.__APP_CONFIG__.
  const stripConfigScriptPlugin: PluginOption = {
    name: "strip-config-script",
    transformIndexHtml(html) {
      if (mode === "runtime") return html;
      return html.replace(/\s*<script\s+src="\/config\.js"><\/script>/i, "");
    },
  };

  // Auto-generate config.js from .env vars for runtime builds.
  // On-prem users edit dist/config.js at deploy time to customise without rebuilding.
  // Uses RuntimeConfigSchema — the same Zod schema as the app — so defaults
  // and coercion ("true" → true) are always in sync.
  const generateRuntimeConfigPlugin: PluginOption = {
    name: "generate-runtime-config",
    writeBundle(options) {
      if (mode !== "runtime") return;

      const config = RuntimeConfigSchema.parse({
        urls: {
          backend: env.VITE_PAYMENTS_URL,
          ai: env.VITE_AI_API_URL,
          platform: env.VITE_PLATFORM_URL,
          database: env.VITE_DATABASE_API_URL,
        },
        authentication: {
          allowEmailLogin: env.VITE_AUTHENTICATION_ALLOW_EMAIL_LOGIN,
          allowRegistration: env.VITE_AUTHENTICATION_ALLOW_REGISTRATION,
          allowForgotPassword: env.VITE_AUTHENTICATION_ALLOW_FORGOT_PASSWORD,
          identityProviders: env.VITE_AUTHENTICATION_IDENTITY_PROVIDERS,
          sendMicrosoftIdToken: env.VITE_AUTHENTICATION_SEND_MICROSOFT_IDTOKEN,
          sendOktaIdToken: env.VITE_AUTHENTICATION_SEND_OKTA_IDTOKEN,
          sendUserEmailAsHeader: env.VITE_AUTHENTICATION_SEND_USER_EMAIL_AS_HEADER,
        },
        authProviders: {
          googleClientId: env.VITE_GOOGLE_OAUTH_CLIENT_ID,
          azureClientId: env.VITE_AZURE_CLIENT_ID,
          azureTenantId: env.VITE_AZURE_TENANT_ID,
          oktaClientId: env.VITE_OKTA_CLIENT_ID,
          oktaDomain: env.VITE_OKTA_DOMAIN,
        },
        copilot: {
          enabled: env.VITE_AI_COPILOT_ENABLED,
          openbbCopilot: env.VITE_AI_COPILOT_OPENBB_COPILOT,
          documentationLinks: env.VITE_AI_COPILOT_DOCUMENTATION_LINKS,
          webSearch: env.VITE_AI_COPILOT_WEB_SEARCH,
          secFilings: env.VITE_AI_COPILOT_SEC_FILINGS,
          jinaAi: env.VITE_AI_COPILOT_JINA_AI,
          aiEnhancements: env.VITE_AI_COPILOT_AI_ENHANCEMENTS,
          showCustomKey: env.VITE_AI_SHOW_CUSTOM_COPILOT_KEY,
        },
        ui: {
          showCompanionMode: env.VITE_UI_SHOW_COMPANION_MCP_MODE,
          showMinimizeWidget: env.VITE_UI_SHOW_MINIMIZE_WIDGET,
          showChartGeneration: env.VITE_UI_SHOW_CHART_GENERATION,
          showFeedbackButton: env.VITE_UI_SHOW_FEEDBACK_BUTTON,
          showInviteButton: env.VITE_UI_SHOW_INVITE_BUTTON,
          showDemoRequestButton: env.VITE_UI_SHOW_DEMO_REQUEST_BUTTON,
          showEnterpriseTags: env.VITE_UI_SHOW_ENTERPRISE_TAGS,
          showExternalDocLinks: env.VITE_UI_SHOW_EXTERNAL_DOCUMENTATION_LINKS,
          showHelpDocumentation: env.VITE_UI_SHOW_HELP_DOCUMENTATION,
          showChangelog: env.VITE_UI_SHOW_CHANGELOG,
          showOnboardingQuestions: env.VITE_UI_SHOW_ONBOARDING_QUESTIONS,
          showTos: env.VITE_UI_SHOW_TOS,
          showCopilotSwitcher: env.VITE_UI_SHOW_COPILOT_SWITCHER,
          showRemoveFromOrg: env.VITE_UI_SHOW_REMOVE_FROM_ORG,
          defaultTheme: env.VITE_UI_DEFAULT_THEME,
          odpDownloadInstaller: env.VITE_UI_ODP_DOWNLOAD_INSTALLER,
          showSalesEmail: env.VITE_UI_SHOW_SALES_EMAIL,
          isLite: env.VITE_LITE,
          showMarketplace: env.VITE_UI_SHOW_MARKETPLACE,
        },
        services: {
          posthog: env.VITE_SERVICES_POSTHOG,
          hubspotForms: env.VITE_SERVICES_HUBSPOT_FORMS,
          email: env.VITE_SERVICES_EMAIL,
          nixtla: env.VITE_SERVICES_NIXTLA,
          cloudflareWorker: env.VITE_SERVICES_CLOUDFLARE_WORKER,
        },
        data: {
          packageDataEnabled: env.VITE_DATA_PACKAGE_DATA_ENABLED,
          allowedDataVendors: env.VITE_DATA_ALLOWED_DATA_VENDORS,
          allowedDbTypes: env.VITE_DATA_ALLOWED_DB_TYPES,
          openDataPlatformInstallerEnabled:
            env.VITE_OPEN_DATA_PLATFORM_INSTALLER_ENABLED,
          allowHtmlJsExecution: env.VITE_ALLOW_HTML_JS_EXECUTION,
        },
        mcp: {
          defaultServerEnabled: env.VITE_MCP_DEFAULT_SERVER_ENABLED,
        },
        analytics: {
          posthogKey: env.VITE_POSTHOG_KEY,
          posthogUrl: env.VITE_POSTHOG_URL,
        },
        whiteLabel: {
          name: env.VITE_WL_NAME,
          shortName: env.VITE_WL_SHORT_NAME,
          loginImage: env.VITE_WL_LOGIN_IMAGE,
          loginImageDark: env.VITE_WL_LOGIN_IMAGE_DARK,
          leftSidebarLogo: env.VITE_WL_LEFT_SIDEBAR_LOGO,
          leftSidebarLogoDark: env.VITE_WL_LEFT_SIDEBAR_LOGO_DARK,
          favicon: env.VITE_WL_FAVICON,
          description: env.VITE_WL_DESCRIPTION,
          keywords: env.VITE_WL_KEYWORDS,
          mainColor: env.VITE_WL_MAIN_COLOR,
          fontFamily: env.VITE_WL_FONT_FAMILY,
          showFloatingThemePreview: env.VITE_WL_SHOW_FLOATING_THEME_PREVIEW,
        },
      });

      // Strip locked fields from config.js — they're baked into the bundle,
      // so there must be no misleading "editable" copy in config.js.
      for (const group of Object.keys(lockedConfig) as Array<keyof LockedConfig>) {
        const groupFields = lockedConfig[group];
        if (!groupFields) continue;
        for (const field of Object.keys(groupFields)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (config as any)[group]?.[field];
        }
      }

      const outDir = options.dir ?? path.resolve("dist");
      writeFileSync(
        path.join(outDir, "config.js"),
        `window.__APP_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`,
      );
    },
  };

  return {
    define: {
      __LOCKED_CONFIG__: JSON.stringify(lockedConfig),
    },
    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    // prevent vite from obscuring rust errors
    clearScreen: false,
    // tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
    },
    // to make use of `TAURI_DEBUG` and other env variables
    // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
    envPrefix: ["VITE_", "TAURI_"],
    optimizeDeps: {
      rolldownOptions: {
        resolve: {
          conditionNames: ["import", "module", "browser", "default"],
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 10000,
      rolldownOptions: {
        output: {
          manualChunks: (id) => {
            if (!id.includes("node_modules")) return;
            const parts = id.split("node_modules/")[1].split("/");
            const pkg = parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];

            if (pkg === "plotly.js-dist-min") return "vendor-plotly";
            if (
              pkg === "monaco-editor" ||
              pkg === "dt-sql-parser" ||
              pkg === "antlr4ng"
            )
              return "vendor-monaco";
            if (pkg.startsWith("highcharts")) return "vendor-highcharts";
            if (pkg.startsWith("@azure/") || pkg.startsWith("@okta/"))
              return "vendor-auth";
            if (pkg.startsWith("@wooorm/")) return "vendor-starry-night";
            if (
              pkg.startsWith("ag-grid") ||
              pkg.startsWith("ag-charts") ||
              pkg.startsWith("@ag-grid")
            )
              return "vendor-ag";
          },
          entryFileNames: "[name].[hash].js",
          chunkFileNames: "[name].[hash].js",
          assetFileNames: "[name].[hash].[ext]",
        },
      },
      // Tauri supports es2021
      target: "esnext",
      // don't minify for debug builds
      minify: process.env.TAURI_DEBUG ? false : "oxc",
      // produce sourcemaps for debug builds
      sourcemap: !!process.env.TAURI_DEBUG,
    },
    resolve: {
      alias: [
        ...(!isTradingViewEnabled
          ? [
              {
                find: /^.*\/TVChartContainer\/TVChartContainerFunc$/,
                replacement: path.resolve(
                  import.meta.dirname,
                  "src/components/Widgets/TVChartContainer/TVChartUnavailable.tsx",
                ),
              },
            ]
          : []),
        { find: "~", replacement: path.resolve(import.meta.dirname, "src") },
      ],
    },
    html: { cspNonce: "VITE_NONCE" },
    worker: { format: "es" },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./vitest.setup.ts",
      exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        exclude: [
          "**/*.test.ts",
          "**/*.test.tsx",
          "**/*.spec.ts",
          "**/*.spec.tsx",
          "**/*config*",
          "**/charting_library/**",
          "**/public/assets/js/**",
          "**/coverage/**",
        ],
      },
      alias: [
        {
          find: /^monaco-editor$/,
          replacement: path.resolve(
            import.meta.dirname,
            "node_modules/monaco-editor/esm/vs/editor/editor.api.js",
          ),
        },
        {
          find: /^react-pdf$/,
          replacement: path.resolve(import.meta.dirname, "tests/mocks/react-pdf.tsx"),
        },
      ],
    },
    plugins: [
      webfontDownload([], { assetsSubfolder: "assets/fonts" }),
      react(),
      VitePWA({
        selfDestroying: true,
        registerType: "autoUpdate",
        devOptions: { enabled: false },
        workbox: {
          cacheId: "openbb-workspace",
          maximumFileSizeToCacheInBytes: 15000000, // 15mb
          cleanupOutdatedCaches: true,
          globIgnores: ["**/charting_library/**"],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkOnly",
            },
          ],
        },
        manifest: {
          // https://web.dev/articles/add-manifest
          name: APP_NAME,
          short_name: APP_SHORT_NAME,
          description: APP_DESCRIPTION,
          theme_color: "#161618",
          background_color: "#161618",
          display: "fullscreen",
          orientation: "portrait",
          start_url: "/",
          icons: IS_SNOWFLAKE
            ? [
                {
                  src: "/favicon/snowflake-favicon.png",
                  type: "image/png",
                  sizes: "300x300",
                },
                {
                  src: "/icons/android/snowflake-launchericon-192-192.png",
                  type: "image/png",
                  sizes: "192x192",
                },
                {
                  src: "/icons/android/snowflake-launchericon-512-512.png",
                  type: "image/png",
                  sizes: "512x512",
                },
              ]
            : [
                {
                  src: "/logo.svg",
                  type: "image/svg+xml",
                  sizes: "300x300",
                },
                {
                  src: "/icons/android/android-launchericon-192-192.png",
                  type: "image/png",
                  sizes: "192x192",
                },
                {
                  src: "/icons/android/android-launchericon-512-512.png",
                  type: "image/png",
                  sizes: "512x512",
                },
              ],
          screenshots: [
            {
              src: "https://openbb-cms.directus.app/assets/6573dc42-39bc-4ab4-9cd0-ff211b28ab6b.png?cache-buster=2024-10-06T16:11:21.818Z",
              sizes: "1300x848",
              type: "image/png",
              form_factor: "wide",
            },
            {
              src: "https://openbb-cms.directus.app/assets/ae22447a-7b40-4ec1-83c5-9486b0a1f55c.png?cache-buster=2024-10-06T16:11:21.818Z",
              sizes: "572x1120",
              type: "image/png",
              form_factor: "narrow",
            },
          ],
        },
      }),
      mdPlugin({ mode: [Mode.MARKDOWN, Mode.REACT] }),
      viteStaticCopy({
        targets: [
          {
            src: ["./src/lib/widgets.json", "./src/lib/sources.json"],
            dest: "assets/data",
          },
          ...(isTradingViewEnabled
            ? [
                {
                  src: "./src/lib/charting_library/**/*",
                  dest: "assets/js/charting_library",
                },
              ]
            : []),
          {
            src: "./node_modules/vscode-oniguruma/release/onig.wasm",
            dest: "assets/wasm",
          },
        ],
      }),
      fullReloadAlways,
      stripConfigScriptPlugin,
      generateRuntimeConfigPlugin,
    ],
  };
});
