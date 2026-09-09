import { debounce, isEqual } from "lodash";
import { toast } from "sonner";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { logout, putEnabledBundles } from "~/api/auth.api";
import { getConfig } from "~/lib/runtimeConfig";
import type { Selector, Ticker } from "~/lib/state/app";
import { useBackendConnectorStore } from "~/lib/state/backendConnector";
import { useMcpToolsStore } from "~/lib/state/mcpTools";
import { showNotification } from "~/lib/utils/toast";
import WIDGET_BUNDLES from "~/lib/widget_bundles.json";
import type { DeveloperOnboardingQuestions, ProLoginResponse } from "~/types/auth.type";
import { useCopilotStore } from "./copilot";
import { useDataConnectorStore } from "./dataConnector";
import { useSharedAppStore } from "./sharedApp";
import { useThemeStore } from "./theme";
import { useTutorialStore } from "./tutorial";
import { useWorkspaceBridgeStore } from "./workspaceBridge";

interface User {
  email: string;
  username: string;
  token: string;
  entity_name: null | string;
  role: null | string;
  uuid: string;
}

interface OnboardingData {
  role: string;
  //approach: string[];
  organizationName: string;
  organization: string;
  assetClasses: string[];
  geographies: string[];
  industrySectors: string[];
  primaryUsage: string;
  programmingExperience: string;
  dataTypes: string[];
  otherDataType: string;
  skipOnboarding: boolean;
}

interface Name {
  first: string;
  last: string;
}

export interface AuthState {
  microsoftIdToken: string;
  oktaIdToken: string;
  perplexityApiKey: string;
  setPerplexityApiKey: (value: string) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (value: string) => void;
  setCopilotApiKeys: (params: {
    perplexityApiKey?: string;
    openaiApiKey?: string;
  }) => void;
  identified: boolean;
  setIdentified: (value: boolean) => void;
  checkNewBundles: (isProTier: boolean) => void;
  debouncedEnabledBundles: () => Promise<void>;
  disabledWidgets: string[];
  toggleWidgetDisabled: (widgetId: string) => void;
  lastVisitedPage: string;
  updateLastVisitedPage: (value: string) => void;
  enabledBundles: string[];
  toggleBundle: (bundleId: string) => void;
  login: (data: ProLoginResponse) => Promise<boolean>;
  logout: () => void;
  tosAccepted: boolean;
  updateTosAccepted: (value: boolean) => void;
  isFirstLogin: boolean;
  showChangelog: boolean;
  updateShowChangelog: (value: boolean) => void;
  user: User | null;
  updateUser: (user: Partial<User>) => void;
  needsOnboarding: boolean;
  needsInAppOnboarding: boolean;
  updateOnboarding: (value: boolean) => void;
  updateInAppOnboarding: (value: boolean) => void;
  onBoardingData: OnboardingData;
  updateOnboardingData: (value: any) => void;
  name: Name;
  updateName: (value: Name) => void;
  searchTickerHistory: TickerHistory[];
  promptHistory: PromptHistory[];
  updatePromptHistory: (value: PromptHistory[]) => void;
  updateSearchTickerHistory: (value: TickerHistory[]) => void;
  alphaWarning: boolean;
  updateAlphaWarning: (value: boolean) => void;
  onboardingQuestions: null | DeveloperOnboardingQuestions;
}

type PromptHistory = {
  prompt: string;
  widgetId: string;
};

type TickerHistory = Ticker;

const DEFAULT_ENABLED_BUNDLES = Object.keys(WIDGET_BUNDLES).filter(
  (bundle) => WIDGET_BUNDLES[bundle].enabled_by_default,
);

function validateOnboarding(
  onboardingQuestions: DeveloperOnboardingQuestions | null,
): boolean {
  if (!onboardingQuestions) return false;
  if (onboardingQuestions.skipOnboarding) return true;
  return !!(onboardingQuestions.role && onboardingQuestions.organization);
}

function ensureNewBundles(
  enabledBundles: string[],
  disabledWidgets: string[],
  isProTier: boolean,
) {
  const newEnabledBundles = [
    ...(enabledBundles.length > 0 ? enabledBundles : DEFAULT_ENABLED_BUNDLES),
  ];

  // Makes sure any new bundles are enabled by default
  for (const [bundleId, bundle] of Object.entries(WIDGET_BUNDLES)) {
    // @ts-expect-error
    if (!bundle.enabled_by_default || (bundle.pro_only && !isProTier)) continue;
    if (
      bundle.widgets.every((widgetId) => !disabledWidgets.includes(widgetId)) &&
      !newEnabledBundles.includes(bundleId)
    ) {
      newEnabledBundles.push(bundleId);
    }
  }

  return newEnabledBundles;
}

export const useAuthStore = createWithEqualityFn<AuthState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        microsoftIdToken: "",
        oktaIdToken: "",
        perplexityApiKey: "",
        setPerplexityApiKey: (value) => set({ perplexityApiKey: value }),
        openaiApiKey: "",
        setOpenaiApiKey: (value) => set({ openaiApiKey: value }),
        setCopilotApiKeys: ({ perplexityApiKey = "", openaiApiKey = "" }) =>
          set({ perplexityApiKey, openaiApiKey }),
        identified: false,
        setIdentified: (value) => set({ identified: value }),
        lastVisitedPage: "/app",
        updateLastVisitedPage: (value) => set({ lastVisitedPage: value }),
        onboardingQuestions: null,
        checkNewBundles: (isProTier: boolean) => {
          const { enabledBundles, disabledWidgets } = get();
          const newEnabledBundles = ensureNewBundles(
            enabledBundles,
            disabledWidgets,
            isProTier,
          );

          if (newEnabledBundles.length === enabledBundles.length) return;
          set({ enabledBundles: newEnabledBundles });
          get().debouncedEnabledBundles();
        },
        debouncedEnabledBundles: debounce(async () => {
          const { enabledBundles, disabledWidgets } = get();
          try {
            await putEnabledBundles({
              enabled_bundles: enabledBundles,
              disabled_widgets: disabledWidgets,
            });
          } catch (error) {
            console.error("Failed to save changes:", error);
            // Optionally, show an error toast here
            toast.error("Failed to save changes");
          }
        }, 2000),
        disabledWidgets: [],
        toggleWidgetDisabled: (widgetId: string) => {
          set((state) => {
            const isCurrentlyDisabled = state.disabledWidgets.includes(widgetId);
            const newDisabledWidgets = isCurrentlyDisabled
              ? state.disabledWidgets.filter((id) => id !== widgetId)
              : [...state.disabledWidgets, widgetId];

            const newEnabledBundles = [...state.enabledBundles];

            if (isCurrentlyDisabled) {
              // If we're enabling the widget, find its bundle and enable it if not already enabled
              const bundleId = Object.keys(WIDGET_BUNDLES).find((id) =>
                WIDGET_BUNDLES[id].widgets.includes(widgetId),
              );
              if (bundleId && !newEnabledBundles.includes(bundleId)) {
                newEnabledBundles.push(bundleId);
              }
            }

            return {
              disabledWidgets: newDisabledWidgets,
              enabledBundles: newEnabledBundles,
            };
          });
          get().debouncedEnabledBundles();
        },
        enabledBundles: DEFAULT_ENABLED_BUNDLES,
        toggleBundle: (bundleId: string) => {
          set((state) => {
            const currentlyEnabled = state.enabledBundles.includes(bundleId);
            const newEnabledBundles = currentlyEnabled
              ? state.enabledBundles.filter((id) => id !== bundleId)
              : [...state.enabledBundles, bundleId];

            if (currentlyEnabled) {
              const bundle = WIDGET_BUNDLES[bundleId];
              const newDisabledWidgets = new Set([
                ...state.disabledWidgets,
                ...bundle.widgets,
              ]);
              return {
                enabledBundles: newEnabledBundles,
                disabledWidgets: Array.from(newDisabledWidgets),
                unsavedChanges: true,
              };
            }

            const newDisabledWidgets = state.disabledWidgets.filter(
              (widgetId) => !WIDGET_BUNDLES[bundleId].widgets.includes(widgetId),
            );

            return {
              enabledBundles: newEnabledBundles,
              disabledWidgets: newDisabledWidgets,
              unsavedChanges: true,
            };
          });
          get().debouncedEnabledBundles();
        },
        showChangelog: false,
        updateShowChangelog: (value) => set({ showChangelog: value }),
        promptHistory: [],
        updatePromptHistory: (value) => set({ promptHistory: value }),
        tosAccepted: false,
        updateTosAccepted: (value) => set({ tosAccepted: value }),
        alphaWarning: true,
        updateAlphaWarning: (value) => set({ alphaWarning: value }),
        searchTickerHistory: [] as TickerHistory[],
        updateSearchTickerHistory: (value) =>
          set({
            searchTickerHistory: Object.values(
              Object.fromEntries(value.map((item) => [item.symbol, item])),
            ),
          }),
        onBoardingData: {
          role: "",
          organizationName: "",
          organization: "",
          assetClasses: [],
          geographies: [],
          industrySectors: [],
          primaryUsage: "",
          programmingExperience: "",
          dataTypes: [],
          otherDataType: "",
          skipOnboarding: false,
        },
        isFirstLogin: false,
        updateOnboardingData: (value) =>
          set({
            onBoardingData: {
              ...get().onBoardingData,
              ...value,
            },
          }),
        updateName: (value) => set({ name: { ...get().name, ...value } }),
        name: { first: "", last: "" },
        login: async (data: ProLoginResponse) => {
          const { sendMicrosoftIdToken, sendOktaIdToken } = getConfig().authentication;
          const isProTier = data?.feature_entitlements?.tier === "pro";

          const { enabled_bundles, disabled_widgets } = data.enabled_widget_bundles;

          const enabledBundles = ensureNewBundles(
            enabled_bundles,
            disabled_widgets,
            isProTier,
          );

          const {
            lastVisitedPage = "/app/data-connectors",
            openaiApiKey,
            perplexityApiKey,
            ...displaySettings
          } = data.user.pro_display_settings;

          data.user.pro_display_settings = displaySettings;

          set((state) => ({
            ...state,
            ...(sendMicrosoftIdToken && {
              microsoftIdToken: data.microsoftIdToken ?? "",
            }),
            ...(sendOktaIdToken && {
              oktaIdToken: data.oktaIdToken ?? "",
            }),
            user: {
              email: data.email,
              username: data.username,
              token: data.access_token,
              entity_name: data.entity_name,
              role: data.role,
              uuid: data.uuid,
            },
            enabledBundles,
            isFirstLogin: data.is_first_login,
            disabledWidgets: disabled_widgets,
            showChangelog: data.show_changelog,
            onboardingQuestions: data.developer_onboarding_info,
            lastVisitedPage,
            openaiApiKey: openaiApiKey || state.openaiApiKey,
            perplexityApiKey: perplexityApiKey || state.perplexityApiKey,
          }));

          const onboardingQuestions = get().onboardingQuestions;

          const user = data.user;
          const isOnboardingValid =
            onboardingQuestions?.skipOnboarding ||
            Boolean(
              user.first_name &&
                user.last_name &&
                validateOnboarding(onboardingQuestions),
            );

          const onBoardingData: OnboardingData | object = {};
          if (onboardingQuestions) {
            Object.assign(onBoardingData, {
              primaryUsage: user.primary_usage || "",
              organization: onboardingQuestions?.organization || "",
              role: onboardingQuestions?.role || "",
              programmingExperience: onboardingQuestions?.programmingExperience || "",
              dataTypes: onboardingQuestions?.dataTypes || [],
              otherDataType: onboardingQuestions?.otherDataType || "",
              organizationName: onboardingQuestions?.organizationName || "",
              skipOnboarding: onboardingQuestions?.skipOnboarding ?? false,
            });
          }

          set({
            name: { first: user.first_name, last: user.last_name },
            onBoardingData: {
              ...get().onBoardingData,
              ...onBoardingData,
            },
            tosAccepted: user?.accepted_pro_tos,
            needsOnboarding: !isOnboardingValid,
          });
          get().debouncedEnabledBundles();

          return isOnboardingValid;
        },
        logout: async () => {
          const data = await logout();
          if (!data?.success) {
            return showNotification({
              message: "Logout Failed",
              description: "An error occurred while logging out. Please try again.",
              toastType: "error",
            });
          }
          useMcpToolsStore.getState().clearAllStorage();
          window.sessionStorage.clear();
          useBackendConnectorStore.persist.clearStorage();
          useDataConnectorStore.persist.clearStorage();
          useThemeStore.persist.clearStorage();
          useTutorialStore.persist.clearStorage();
          useSharedAppStore.persist.clearStorage();
          useCopilotStore.persist.clearStorage();
          useAuthStore.persist.clearStorage();
          useWorkspaceBridgeStore.persist.clearStorage();
          window.history.pushState(null, "", "/login");
          window.location.reload();
        },
        user: null,
        updateUser: (user) =>
          set((state) => ({ user: { ...(state.user ?? ({} as User)), ...user } })),
        needsOnboarding: false,
        updateOnboarding: (value) => set({ needsOnboarding: value }),
        needsInAppOnboarding: true,
        updateInAppOnboarding: (value) => set({ needsInAppOnboarding: value }),
      }),
      {
        name: "auth-storage",
        version: 12,
        migrate: (persistedState: AuthState) => {
          persistedState.user = null;
          return persistedState;
        },
      },
    ),
  ),
  shallow,
);

export type AuthStore = typeof useAuthStore;

export function useShallowAuthStore<S extends AuthState, T>(
  selector: Selector<S, T>,
): T {
  return useAuthStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}
