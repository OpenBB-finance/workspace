import "@jose-donato/react-grid-layout/css/styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { AgChartsEnterpriseModule } from "ag-charts-enterprise";
import {
  AllEnterpriseModule,
  LicenseManager,
  ModuleRegistry,
} from "ag-grid-enterprise";
import posthog from "posthog-js";
import {
  Fragment,
  lazy,
  memo,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
} from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import queryClient from "./queryClient";
import "react-resizable/css/styles.css";
import { createBrowserRouter, Link, Navigate, useRouteError } from "react-router-dom";
import Icon from "~/components/Icon";
import "./index.css";
import { registerSW } from "virtual:pwa-register";
import { PostHogProvider } from "posthog-js/react";
import { ErrorBoundary } from "react-error-boundary";
import { useMcpAuthHandler } from "./components/AI/hooks/mcp/onMcpAuth";
import { setGlobalGridOptions } from "./components/General/Table/AgGrid";
import AuthWelcome from "./components/LayoutAuth/AuthWelcome";
import {
  inSnowflakeNativeApp,
  TOOLTIP_OPEN_DELAY_MS,
  TOOLTIP_SKIP_DELAY_MS,
} from "./lib/constants";
import { getEnabledIdentityProviders } from "./lib/onPremFeatureFlags";
import { getConfig } from "./lib/runtimeConfig";
import { useShallowAuthStore } from "./lib/state/auth";
import { useShallowThemeStore } from "./lib/state/theme";
import {
  applyBrandColors,
  applyFontFamily,
  applyWhiteLabelMeta,
} from "./utils/colorUtils";

// Auth provider lazy loading — only loads SDK when the provider is enabled
const LazyMsalProvider = lazy(() => import("./providers/MsalProviderWrapper"));
const LazyOktaProvider = lazy(() => import("./providers/OktaProviderWrapper"));
const LazyGoogleProvider = lazy(() => import("./providers/GoogleProviderWrapper"));

// Route-level lazy loading
const WidgetsBuilder = lazy(
  () => import("./components/DataConnectors/WidgetsBuilder/WidgetsBuilder"),
);
const Setup2FA = lazy(() => import("./routes/2fa"));
const AppsPage = lazy(() => import("./routes/Apps"));
const AuthedAppNotFound = lazy(() => import("./routes/AuthedAppNotFound"));
const AdminHome = lazy(() => import("./routes/admin"));
const AdminAccountSettings = lazy(() => import("./routes/admin/account"));
const AdminApps = lazy(() => import("./routes/admin/apps"));
const AdminGroups = lazy(() => import("./routes/admin/roles"));
const AdminMarketplace = lazy(() => import("./routes/admin/marketplace"));

const AdminThemeSettings = lazy(() => import("./routes/admin/themeSettings"));
const AdminUsers = lazy(() => import("./routes/admin/users"));
const AILibrary = lazy(() => import("./routes/aiLibrary"));
const MenuHomePage = lazy(() => import("./routes/appHome"));
const BookingPage = lazy(() => import("./routes/booking"));
const ConnectionsPage = lazy(() => import("./routes/Connections"));
const DeveloperOnboardingHomepage = lazy(
  () => import("./routes/developer_onboarding/DeveloperOnboardingHomepage"),
);
const Ds = lazy(() => import("./routes/ds"));
const ForgotPasswordPage = lazy(() => import("./routes/forgotPassword"));
const ForgotPasswordConfirmationPage = lazy(
  () => import("./routes/forgotPasswordConfirmation"),
);
const HomePage = lazy(() => import("./routes/home"));
const LoginPage = lazy(() => import("./routes/login"));
const DataConnectors = lazy(() => import("./routes/newDataConnectors"));
const NewsPage = lazy(() => import("./routes/news"));
const RegisterPage = lazy(() => import("./routes/register"));
const Settings = lazy(() => import("./routes/settings"));
const TabPage = lazy(() => import("./routes/tab"));
const TOSPage = lazy(() => import("./routes/tos"));

const LayoutAdmin = lazy(() => import("./components/LayoutAdmin"));
const LayoutUnauth = lazy(() => import("./components/LayoutUnauth"));
const App = lazy(() => import("./components/LayoutAuth"));
const RootLayout = lazy(() => import("./components/RootLayout"));
const TooltipProvider = lazy(() =>
  import("./components/Tooltip").then((mod) => ({ default: mod.TooltipProvider })),
);

const MsalTokenRefresh = lazy(() => import("./components/MsalTokenRefresh"));

// Conditionally load react-scan for render scanning (stays build-time: dev-only tool)
if (
  typeof window !== "undefined" &&
  import.meta.env.VITE_ENABLE_RENDER_SCANNING === "true"
) {
  const script = document.createElement("script");
  script.src = "//unpkg.com/react-scan/dist/auto.global.js";
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

LicenseManager.setLicenseKey(
  "Using_this_{AG_Charts_and_AG_Grid}_Enterprise_key_{AG-088127}_in_excess_of_the_licence_granted_is_not_permitted___Please_report_misuse_to_legal@ag-grid.com___For_help_with_changing_this_key_please_contact_info@ag-grid.com___{OpenBB}_is_granted_a_{Single_Application}_Developer_License_for_the_application_{OpenBB-Pro}_only_for_{2}_Front-End_JavaScript_developers___All_Front-End_JavaScript_developers_working_on_{OpenBB-Pro}_need_to_be_licensed___{OpenBB-Pro}_has_been_granted_a_Deployment_License_Add-on_for_{3}_Production_Environments___This_key_works_with_{AG_Charts_and_AG_Grid}_Enterprise_versions_released_before_{26_October_2025}____[v3]_[0102]_MTc2MTQzMzIwMDAwMA==beb256f2264088d7376ddc63ea4e646c",
);
ModuleRegistry.registerModules([AllEnterpriseModule.with(AgChartsEnterpriseModule)]);

setGlobalGridOptions();

function OAuthCallback() {
  const handleMcpAuthorization = useMcpAuthHandler();

  useEffect(() => {
    handleMcpAuthorization();
  }, [handleMcpAuthorization]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center text-light-900 dark:text-light-50">
        Authenticating… this window will close.
      </div>
    </div>
  );
}

function ErrorElement() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center text-light-900 dark:text-light-50">
        <Icon id="warning-icon" className="mx-auto h-10 w-10" />
        <h1 className="mt-4 text-lg font-bold uppercase tracking-wide">
          An error occurred
        </h1>
        <p className="mb-10 mt-2.5 text-xl">Something went wrong.</p>
        <Link to="/" className="obb-btn-tertiary h-10 text-sm">
          Go back home
        </Link>
      </div>
    </div>
  );
}

function RouterErrorElement() {
  const error = useRouteError() as Error;
  if (posthog) {
    posthog.capture("Error_critical", {
      error: {
        error: error?.stack,
      },
    });
  }
  return <ErrorElement />;
}

const AuthGuard = memo(({ children }: { children?: ReactNode }) => {
  const needsOnboarding = useShallowAuthStore(
    (s) => s.user?.token && s.needsOnboarding,
  );

  return useMemo(() => {
    const Wrapper = getEnabledIdentityProviders().includes("microsoft")
      ? MsalTokenRefresh
      : Fragment;

    return needsOnboarding ? null : (
      <Fragment key="auth-guard">
        <AuthWelcome key="auth-welcome" />
        <Suspense fallback={null}>
          <Wrapper key="auth-wrapper">
            <S children={<App key="app">{children}</App>} />
          </Wrapper>
        </Suspense>
      </Fragment>
    );
  }, [needsOnboarding, children]);
});

const S = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={null}>{children}</Suspense>
);

const router = createBrowserRouter([
  {
    path: "/oauth",
    element: <S children={<LayoutUnauth />} />,
    errorElement: <RouterErrorElement />,
    children: [{ path: "callback", element: <OAuthCallback />, id: "oauth-callback" }],
  },
  {
    path: "/",
    element: <S children={<RootLayout />} />,
    errorElement: <RouterErrorElement />,
    children: [
      {
        path: "/",
        element: <S children={<LayoutUnauth />} />,
        children: [
          {
            index: true,
            element: <S children={<HomePage />} />,
            id: "home",
          },
          {
            path: "login",
            element: <S children={<LoginPage />} />,
            id: "login",
          },
          {
            path: "register",
            element: <S children={<RegisterPage />} />,
            id: "register",
          },
          {
            path: "terms-of-service",
            element: <S children={<TOSPage />} />,
            id: "terms-of-service",
          },
          {
            path: "booking",
            element: <S children={<BookingPage />} />,
            id: "booking",
          },
          {
            path: "forgot-password",
            element: <S children={<ForgotPasswordPage />} />,
            id: "forgot-password",
          },
          {
            path: "forgot-password-confirmation",
            element: <S children={<ForgotPasswordConfirmationPage />} />,
            id: "forgot-password-confirmation",
          },
          {
            path: "onboarding",
            element: <S children={<DeveloperOnboardingHomepage />} />,
            id: "onboarding",
          },
          {
            path: "developer-onboarding",
            element: <Navigate to="/onboarding" />,
            id: "developer-onboarding",
          },
        ],
      },
      {
        path: "/2fa",
        element: <S children={<Setup2FA />} />,
      },
      {
        path: "/app",
        element: <AuthGuard />,
        children: [
          {
            path: "ds",
            element: <S children={<Ds />} />,
          },
          { path: "data-connectors", element: <Navigate to="/app" /> },
          {
            path: "",
            element: <S children={<AppsPage />} />,
          },
          {
            path: "marketplace/:appSlug",
            element: <S children={<AppsPage />} />,
          },
          {
            path: "help-documentation",
            element: <S children={<MenuHomePage />} />,
            id: "app-help-documentation",
          },
          {
            path: ":id",
            element: <S children={<TabPage />} />,
            id: "app-tab",
          },
          {
            path: "news",
            element: <S children={<NewsPage />} />,
            id: "app-news",
          },
          {
            path: "data-connectors",
            element: <Navigate to="/app/widgets" />,
            id: "app-data-connectors",
          },
          {
            path: "widget-studio",
            element: <S children={<WidgetsBuilder />} />,
            id: "app-widget-studio",
          },
          {
            path: "widgets",
            element: <S children={<DataConnectors />} />,
            id: "app-widgets",
          },
          {
            path: "ai",
            element: <S children={<AILibrary />} />,
            id: "app-ai",
          },
          {
            path: "prompt-library",
            element: <Navigate to="/app/ai?tab=prompts" />,
            id: "app-prompt-library",
          },
          {
            path: "prompts",
            element: <Navigate to="/app/ai?tab=prompts" />,
            id: "app-prompts",
          },
          {
            path: "settings",
            element: <S children={<Settings />} />,
            id: "app-settings",
          },
          {
            path: "connections",
            element: <S children={<ConnectionsPage />} />,
            id: "app-connections",
          },

          {
            path: "*",
            element: <S children={<AuthedAppNotFound />} />,
          },
        ],
      },
      {
        path: "/admin",
        element: <S children={<LayoutAdmin />} />,
        children: [
          {
            index: true,
            element: <S children={<AdminHome />} />,
            id: "admin-homepage",
          },
          {
            path: "users",
            element: <S children={<AdminUsers />} />,
            id: "admin-users",
          },
          {
            path: "roles",
            element: <S children={<AdminGroups />} />,
            id: "admin-roles",
          },
          {
            path: "apps",
            element: <S children={<AdminApps />} />,

            id: "admin-apps",
          },
          {
            path: "marketplace",
            element: <S children={<AdminMarketplace />} />,
            id: "admin-marketplace",
          },
          {
            path: "theme-settings",
            element: <S children={<AdminThemeSettings />} />,
            id: "admin-theme-settings",
          },
          {
            path: "account",
            element: <S children={<AdminAccountSettings />} />,
            id: "admin-account",
          },
        ],
      },
    ],
  },
]);

const AUTH_WRAPPERS = {
  microsoft: LazyMsalProvider,
  okta: LazyOktaProvider,
  google: LazyGoogleProvider,
} as const;

function Root() {
  const setTheme = useShallowThemeStore((state) => state.setTheme);

  const enabledProviders = useMemo(() => getEnabledIdentityProviders(), []);

  const RootContent = useMemo(() => {
    const content = (
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>
          <TooltipProvider
            delayDuration={TOOLTIP_OPEN_DELAY_MS}
            skipDelayDuration={TOOLTIP_SKIP_DELAY_MS}
          >
            <RouterProvider router={router} />
          </TooltipProvider>
        </Suspense>
      </QueryClientProvider>
    );
    return enabledProviders.reduce((content, provider) => {
      const Comp = AUTH_WRAPPERS[provider];
      return <Comp key={`${provider}-wrapper`}>{content}</Comp>;
    }, content);
  }, [enabledProviders]);

  useEffect(() => {
    const defaultTheme = getConfig().ui.defaultTheme || "dark";
    const localTheme = window.localStorage.getItem("theme") ?? defaultTheme;
    const theme = ["light", "dark"].includes(localTheme) ? localTheme : defaultTheme;
    setTheme(theme as "light" | "dark");
  }, []);

  return <Suspense fallback={null}>{RootContent}</Suspense>;
}

if ("serviceWorker" in navigator) {
  registerSW({ immediate: true });
}

function bootstrap() {
  const config = getConfig();

  // Apply branding from runtime config
  if (config.whiteLabel.mainColor) {
    applyBrandColors(config.whiteLabel.mainColor);
  }
  if (config.whiteLabel.fontFamily) {
    applyFontFamily(config.whiteLabel.fontFamily);
  }

  // Override HTML meta tags from runtime config (no SEO needed for on-prem)
  applyWhiteLabelMeta(config.whiteLabel);

  if (inSnowflakeNativeApp) {
    const snowflakeFavicon = "/favicon/snowflake-favicon.png";
    document.querySelector('link[rel="icon"]')?.setAttribute("href", snowflakeFavicon);
    document
      .querySelector('link[rel="apple-touch-icon"]')
      ?.setAttribute("href", snowflakeFavicon);
    console.log("[bootstrap] Snowflake favicon override applied");
  }

  const root = createRoot(document.getElementById("root") as HTMLElement);
  root.render(
    <ErrorBoundary
      FallbackComponent={ErrorElement}
      onError={(error) => {
        console.error(error);
      }}
    >
      {config.services.posthog ? (
        <PostHogProvider
          apiKey={config.analytics.posthogKey}
          options={{
            api_host: config.analytics.posthogUrl,
            ui_host: "app.posthog.com",
            session_recording: {
              maskAllInputs: true,
              maskInputFn: (text, element: HTMLElement | { attributes: any }) => {
                if (
                  element?.attributes?.name?.value === "password" ||
                  element?.attributes?.name?.value === "Password" ||
                  element?.attributes?.id?.value === "api-key"
                ) {
                  return "*".repeat(text.length);
                }
                return text;
              },
              maskInputOptions: {
                password: true,
              },
            },
          }}
        >
          <Root />
          <div id="dropdown-portal" />
        </PostHogProvider>
      ) : (
        <>
          <Root />
          <div id="dropdown-portal" />
        </>
      )}
    </ErrorBoundary>,
  );
}

bootstrap();
