import dayjs from "dayjs";
import isEqual from "lodash.isequal";

import posthog from "posthog-js";
import type React from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { updateZeroToHero } from "~/api/auth.api";
import AddingAppsNote from "~/components/InAppOnboarding/Walkthrough/General/Description/AddingAppsNote";
import AddingWidgetsNote from "~/components/InAppOnboarding/Walkthrough/General/Description/AddingWidgetsNote";
import AdvancedFeaturesNote from "~/components/InAppOnboarding/Walkthrough/General/Description/AdvancedFeaturesNote";
import HelpDocumentationNote from "~/components/InAppOnboarding/Walkthrough/General/Description/HelpDocumentationNote";
import GeneralIntroNote from "~/components/InAppOnboarding/Walkthrough/General/Description/IntroNote";
import MeetCopilotNote from "~/components/InAppOnboarding/Walkthrough/General/Description/MeetCopilotNote";
import QueryingCopilotNote from "~/components/InAppOnboarding/Walkthrough/General/Description/QueryingCopilotNote";
import SaveCopilotNote from "~/components/InAppOnboarding/Walkthrough/General/Description/SaveCopilotNote";
import type { Walkthroughs } from "~/types/auth.type";
import type { Selector } from "./app";

const WALKTHROUGHS: Walkthroughs = {
  analyst_walkthrough: null,
};

function combineVersions(
  oldWalkthrough: Walkthroughs,
  newWalkthrough: Walkthroughs,
): Walkthroughs {
  const cleaned = Object.entries(newWalkthrough).map(([key, value]) => [
    key,
    value || oldWalkthrough[key] || null,
  ]);
  return Object.fromEntries(cleaned);
}

export const WALKTHROUGH_STEPS = {
  analyst_walkthrough: [
    {
      id: "general-intro",
      title: "Intro",
      targetElementSelector: "#tabs li[class*='obb-navigation-item-active']",
      description: <GeneralIntroNote />,
      side: "right",
      onContinueAction: "expandCopilot",
      beforeElementSelectionAction: "newCopilotChat",
    },
    {
      id: "general-adding-widgets",
      title: "Adding widgets to your dashboard",
      targetElementSelector: "[data-testid='dashboard-toolbar-add-widget-button']",
      description: <AddingWidgetsNote />,
      side: "top",
      onContinueAction: "createEarningHistoryWidget",
    },
    {
      id: "general-meet-copilot",
      title: "Meet OpenBB Copilot",
      targetElementSelector: "#message-plus",
      description: <MeetCopilotNote />,
      side: "bottom",
      onContinueAction: "addEarningHistoryWidgetToContext",
    },
    {
      id: "general-querying-copilot",
      title: "Querying the Copilot",
      targetElementSelector: "#right-panel",
      description: <QueryingCopilotNote />,
      side: "left",
      onContinueAction: "askCopilotGeneralEarningSurprisePercentage",
    },
    {
      id: "general-save-copilot",
      title: "Save Copilot's answers",
      targetElementSelector: "._copy-chart-data-button",
      description: <SaveCopilotNote />,
      side: "left",
      onContinueAction: "createCopilotWidgetGeneralEarningSurprisePercentage",
    },
    {
      id: "general-advanced-features",
      title: "Advanced features",
      targetElementSelector: "#mcp-tools-btn",
      description: <AdvancedFeaturesNote />,
      side: "top",
    },
    {
      id: "general-adding-apps",
      title: "Adding your custom App",
      targetElementSelector: "#apps",
      description: <AddingAppsNote />,
      side: "right",
      beforeElementSelectionAction: "navigateToApps",
      skipAutoNavigateBack: true,
    },
    {
      id: "general-help-docs",
      title: "Help and Documentation",
      targetElementSelector: "._help-documentation",
      description: <HelpDocumentationNote />,
      side: "right",
      beforeElementSelectionAction: "clickHamburgerMenu",
    },
  ],
} as const satisfies Record<string, WalkthroughStep[]>;

type WalkthroughName = keyof typeof WALKTHROUGH_STEPS;

interface WalkthroughState {
  currentWalkthrough: WalkthroughName | null;
  currentStep: number;
  walkthroughs: Walkthroughs;
  copilotArtifact: any;
  workingDashboardUUID: string | null;
  restartWalkthrough: (
    walkthroughName: WalkthroughName,
    workingDashboardUUID: string,
  ) => void;
  endWalkthrough: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  setCompletedDates: (walkthroughs: Walkthroughs) => void;
}

export type WalkthroughStep = {
  id: string;
  targetElementSelector: string;
  title: string;
  description: string | React.ReactNode;
  side?: "top" | "bottom" | "right" | "left";
  type?: "dialog";
  delay?: number;
  onContinueAction?: string | string[] | null;
  beforeElementSelectionAction?: string | null;
  skipAutoNavigateBack?: boolean;
};

export function cleanupWalkthroughPosthogProperties() {
  posthog.unregister("isWalkthrough");
  posthog.unregister("walkthroughName");
}

export const useWalkthroughStore = create<WalkthroughState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        currentWalkthrough: null,
        currentStep: 0,
        walkthroughs: WALKTHROUGHS,
        workingDashboardUUID: null,
        copilotArtifact: null,
        restartWalkthrough: (walkthroughName, workingDashboardUUID) => {
          if (posthog) {
            posthog.register({
              isWalkthrough: true,
              walkthroughName: walkthroughName,
            });

            posthog.capture("Started_Walkthrough", {
              walkthroughName: walkthroughName,
            });
          }
          set((state) => {
            return {
              currentWalkthrough: walkthroughName,
              currentStep: 0,
              workingDashboardUUID: workingDashboardUUID,
              walkthroughs: {
                ...state.walkthroughs,
                [walkthroughName]: null,
              },
            };
          });
        },
        setCompletedDates: (newWalkthroughs: Walkthroughs) => {
          const { walkthroughs } = get();
          const combined = combineVersions(walkthroughs, newWalkthroughs);
          if (!isEqual(walkthroughs, combined)) {
            updateZeroToHero(combined);
          }
          set({ walkthroughs: combined });
        },
        endWalkthrough: () => {
          const state = get();
          const walkthroughs = { ...state.walkthroughs };
          if (state.currentWalkthrough !== null) {
            walkthroughs[state.currentWalkthrough] = dayjs().toISOString();
            updateZeroToHero(walkthroughs);
          }

          if (posthog) {
            if (state.currentWalkthrough) {
              const isFinished =
                state.currentWalkthrough !== null
                  ? WALKTHROUGH_STEPS[state.currentWalkthrough]?.[state.currentStep] ===
                    WALKTHROUGH_STEPS[state.currentWalkthrough]?.at(-1)
                  : false;

              const stepId =
                state.currentWalkthrough !== null
                  ? WALKTHROUGH_STEPS[state.currentWalkthrough]?.[state.currentStep]?.id
                  : undefined;

              const walkthroughName = state.currentWalkthrough ?? null;

              if (isFinished) {
                posthog.capture("Finished_Walkthrough", {
                  walkthroughName: walkthroughName,
                });
                toast.success("Walkthrough completed!", {
                  description: "Congratulations! You've completed the walkthrough.",
                  action: {
                    label: "Read Documentation",
                    onClick: () =>
                      window.open("https://docs.openbb.co/workspace", "_blank"),
                  },
                });
              } else {
                posthog.capture("Left_Walkthrough", {
                  walkthroughName: walkthroughName,
                  stepId: stepId,
                  step: state.currentStep,
                });
              }
            } else {
              posthog.capture("Skipped_Walkthrough", {});
            }
            cleanupWalkthroughPosthogProperties();
          }

          set((state) => {
            if (state.currentWalkthrough !== null) {
              return {
                currentWalkthrough: null,
                currentStep: 0,
                workingDashboardUUID: null,
                walkthroughs,
              };
            }
            return state;
          });
        },
        nextStep: () =>
          set((state) => {
            if (posthog) {
              const stepId =
                WALKTHROUGH_STEPS[state.currentWalkthrough][state.currentStep].id;

              const eventName = `Completed_Step_${state.currentStep}`;

              posthog.capture(eventName, {
                walkthroughName: state.currentWalkthrough,
                stepId: stepId,
                step: state.currentStep,
              });
            }
            return { currentStep: state.currentStep + 1 };
          }),
        prevStep: () =>
          set((state) => {
            return { currentStep: state.currentStep - 1 };
          }),
        goToStep: (step: number) => set({ currentStep: step }),
        setCopilotArtifact: (artifact: any) => set({ copilotArtifact: artifact }),
      }),
      {
        name: "walkthrough-storage",
        version: 4,
        migrate: async (persistedState: any, version: number) => {
          if (version < 4) {
            persistedState.walkthroughs = Object.fromEntries(
              Object.entries(persistedState.walkthroughs).map(([key, value]) => [
                key,
                // @ts-expect-error
                value?.completedDate || null,
              ]),
            );
          } else {
            persistedState.walkthroughs = WALKTHROUGHS;
          }
          return persistedState;
        },
      },
    ),
  ),
);

export function useShallowWalkthroughStore<S extends WalkthroughState, T>(
  selector: Selector<S, T>,
): T {
  return useStoreWithEqualityFn(
    useWalkthroughStore,
    useShallow(selector),
    (prev, next) => isEqual(prev, next),
  );
}
