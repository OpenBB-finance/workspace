import dayjs from "dayjs";
import isEqual from "lodash.isequal";

import posthog from "posthog-js";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import { updateZeroToHero } from "~/api/auth.api";
import type { Challenges } from "~/types/auth.type";
import type { KeySelector, Selector } from "./app";

/*
 * This store is halfway through a refactor, for not I removed everything not necessary, and
 * save both locally and and remotely. In the future, we can remove the local storage and
 * simplify TUTORIALS to just be [key: string]: string | null (a datetime)
 */

const TUTORIALS: Challenges = {
  table_charting: null,
  grouping: null,
  data_connectors: null,
  charting: null,
  group_sector_companies: null,
};

function combineVersions(oldTutorial: Challenges, newTutorial: Challenges): Challenges {
  const cleaned = Object.entries(newTutorial).map(([key, value]) => [
    key,
    value || oldTutorial[key] || null,
  ]);
  return Object.fromEntries(cleaned);
}

export const TUTORIAL_STEPS = {
  onboarding: [
    {
      title: "Welcome to OpenBB",
      description:
        "Getting started with a new tool can be daunting. We're here to guide you through our platform and help you make the best of your data step-by-step.",
      type: "dialog",
    },
  ],
  table_charting: [
    {
      title: "Generate Charts from raw data",
      targetElementSelector: ".widget-financial_statements ._chart-dropdown",
      description: `<div>
        <img src="/assets/images/home/tutorials/Chart.gif" class="w-full h-[182px] rounded mb-2" />
        Welcome to our chart generation feature, where you can easily turn data into visual representations. In this tutorial, we'll guide you through a few simple steps. Let's get started!
        </div>`,
    },
    {
      title: "Step 1 of 4",
      targetElementSelector: ".widget-financial_statements [role='row']:nth-child(3)",
      description:
        "Start by clicking and dragging your mouse to select a specific data range. You can also double click the row header to select the whole row.",
    },
    {
      title: "Step 2 of 4",
      targetElementSelector: ".widget-financial_statements ._chart-dropdown",
      description: `<div>
          <p>
            After selecting your data, it's time to access the chart options. You have
            two methods to achieve this:
          </p>
          <ol class="list-decimal ml-4 mt-1">
            <li>
              <strong className="mr-0.5">Click on the Chart Icon: </strong> This icon
              is always located at the top of each widget. However, it's only
              accessible after selecting data in the table.
            </li>
            <li>
              <strong class="mr-0.5">Right-click:</strong>
              Alternatively, you can right-click on the chosen data area. This action
              will also open a context menu with chart options.
            </li>
          </ol>
        </div>
        `,
    },
    {
      title: "Step 3 of 4",
      targetElementSelector: ".ag-menu.ag-ltr.ag-popup-child",
      description:
        "After clicking on the chart icon, choose the chart type that best aligns with your data and visualization requirements.",
    },
    {
      title: "Step 4 of 4",
      description: "You can now see the chart in a new widget.",
      targetElementSelector: ".widget-ag_chart_from_table",
    },
  ],
  grouping: [
    {
      title: "Grouping Mechanism",
      targetElementSelector: ".widget-company_news ._group-dropdown",
      description: `<div>
        <img src="/assets/images/home/tutorials/Whiteboard.gif" class="w-full h-[182px] rounded mb-2" />
        Let's dive into the grouping mechanism. This feature allows you to create groups of widgets linked to specific tickers, ensuring automatic updates as you switch between tickers. Meaning you can easily search for multiple tickers in a single dashboard.
        </div>`,
      side: "top",
    },
    /*{
      title: "Step 1 of 11",
      targetElementSelector: "._add-widget-button",
      description:
        "Before creating a group, let’s add a new widget to your dashboard.",
      onBeforeNext: () => {
        (document.querySelector("._add-widget-button") as HTMLElement)?.click();
      },
    },
    {
      title: "Step 2 of 11",
      targetElementSelector: "#_add-widget-button2",
      description: "Click on 'Add Widget' open widget menu.",
      onBeforeNext: () => {
        (document.querySelector("._search-button") as HTMLElement)?.click();
      },
    },
    {
      title: "Step 3 of 11",
      targetElementSelector: ".widget-company_profile",
      description: "Select 'Company Profile' widget.",
    },
    {
      title: "Step 4 of 11",
      targetElementSelector: "#_add-widgets-button",
      description: "Click on 'Add Widgets' to add the widget to your dashboard.",
    },*/
    {
      title: "Step 1 of 7",
      targetElementSelector: ".widget-company_news ._group-dropdown",
      description:
        "As you can see, the widget is part of a group. Click on it to change the group.",
    },
    {
      title: "Step 2 of 7",
      targetElementSelector: "._group-dropdown-company_news",
      description: "Select 'Create a group' to create a new group for this widget.",
    },
    {
      title: "Step 3 of 7",
      targetElementSelector: "._group-dropdown-trigger-analyst_price_target",
      description: "Now open the 'Price Target' group dropdown.",
    },
    {
      title: "Step 4 of 7",
      targetElementSelector: "._group-dropdown-analyst_price_target",
      description: "And assign this widget to the same group.",
    },
    {
      title: "Step 5 of 7",
      targetElementSelector: ".widget-analyst_price_target ._select-ticker",
      description: "Now open the 'Price Target' select ticker dropdown.",
    },
    {
      title: "Step 6 of 7",
      targetElementSelector: "._watchlist-element-MSFT",
      description: "Select 'MSFT' ticker.",
    },
    {
      title: "Step 7 of 7",
      targetElementSelector: ".widget-company_news ._select-ticker",
      description: "Notice how both widgets are now linked to the same ticker.",
    },
  ],
  data_connectors: [
    {
      title: "Import your data",
      targetElementSelector: "._add_data_button",
      description: `<div>
        <img src="/assets/images/home/tutorials/Data-Connectors.gif" class="w-full h-[182px] rounded mb-2" />
        Import data into the Workspace from JSON-enabled endpoints, unlocking OpenBB's powerful features like generative AI and chart creation
        </div>`,
    },
    {
      title: "Step 1 of 5",
      targetElementSelector: "._add_data_button",
      description: "Click '+ Add Data' to see all of the different data you can add.",
    },
    {
      title: "Step 2 of 5",
      targetElementSelector: "._button_single",
      description: "Click 'Add Single Widget' and complete all required fields.",
    },
    {
      title: "Step 3 of 5",
      targetElementSelector: "._test-single-widget",
      description: `<div>
      After filling in the fields, always run a test for validation.
      <br />
      <div>
        Here are some examples for the fields:
        <ul class="mt-1 space-y-1">
          <li>
            <strong class="mr-0.5">Name:</strong> <code class="text-[11px]">Crypto Top Protocols</code>
          </li>
          <li>
            <strong class="mr-0.5">Endpoint URL:</strong> <code class="text-[11px]">https://api.llama.fi/protocols</code>
          </li>
          </ul>
      </div>
      </div>`,
      side: "bottom",
    },
    {
      title: "Step 4 of 5",
      targetElementSelector: "._add-single-widget",
      description:
        "If the test is successful, you can add the widget to the Workspace.",
      side: "bottom",
    },
    {
      title: "Step 5 of 5",
      targetElementSelector: "._toast-success",
      description: "Now you can add the widget to your dashboard.",
    },
  ],
  charting: [
    {
      title: "Charting",
      type: "dialog",
      description: `Explore advanced charting effortlessly with this feature. Conduct Technical Analysis, compare securities, and analyze financial data of different companies. Let's begin your journey into advanced charting.
        <br />
        <br />
        <video
            className="h-full w-full rounded object-cover object-center overflow-hidden"
            src="https://openbb-cms.directus.app/assets/4eb0f651-778d-45b7-8e08-ce593dc02bfd"
            controls
          />
        `,
    },
  ],
  group_sector_companies: [
    {
      side: "top",
      title: "Research a group of sector companies",
      targetElementSelector: ".widget-watchlist",
      description: `<div>
        Explore a set of sector companies and their financials. This feature allows you to compare and analyze the financials of different companies within the same sector. Let's get started!
        </div>`,
    },
    {
      title: "Step 1 of 4",
      side: "top",
      targetElementSelector: ".widget-watchlist ._tutorial-select-tickers",
      description: "Start by adding a ticker from the dropdown.",
    },
    {
      side: "top",
      title: "Step 2 of 4",
      targetElementSelector: "._tutorial-select-tickers-container",
      description: "Add a new ticker to the watchlist that isn't selected yet.",
    },
    {
      title: "Step 3 of 4",
      side: "bottom",
      targetElementSelector: ".widget-watchlist .ag-row-last",
      delay: 2500,
      description:
        "The ticker is now part of the watchlist. The watchlist widget is unique because you can quickly change the widget groupings. <br />Click on the ticker you just added to change the main ticker on all the widgets in your current dashboard.",
    },
    {
      title: "Step 4 of 4",
      targetElementSelector: ".widget-company_news",
      description:
        "Notice how all widgets are now in the same group as the ticker you selected.",
    },
  ],
};

interface TutorialState {
  currentTutorial: string | null;
  currentStep: number;
  tutorials: Challenges;
  startTutorial: (tutorialName: string) => void;
  restartTutorial: (tutorialName: string) => void;
  endTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  setCompletedDates: (challenges: Challenges) => void;
}

export interface TutorialStep {
  targetElementSelector: string;
  title: string;
  description: string;
  side?: "top" | "bottom";
  type?: "dialog";
  delay?: number;
  onBeforeNext?: () => void;
}

export const useTutorialStore = createWithEqualityFn<TutorialState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        currentTutorial: null,
        currentStep: 0,
        tutorials: TUTORIALS,
        restartTutorial: (tutorialName) => {
          if (posthog) {
            posthog.capture("Started_Tutorial", {
              tutorial: tutorialName,
            });
          }
          set((state) => {
            return {
              currentTutorial: tutorialName,
              currentStep: 0,
              tutorials: {
                ...state.tutorials,
                [tutorialName]: null,
              },
            };
          });
        },
        startTutorial: (tutorialName) => {
          set((state) => {
            if (!state.tutorials[tutorialName]) {
              return { currentTutorial: tutorialName, currentStep: 0 };
            }
            return {};
          });
        },
        setCompletedDates: (challenges: Challenges) => {
          // This overcomplication can be removed in the future, for now we need to sync
          // users existing localstorage save with their new save in the cloud
          const { tutorials } = useTutorialStore.getState();
          const combined = combineVersions(tutorials, challenges);
          if (!isEqual(challenges, combined)) {
            updateZeroToHero(combined);
          }
          set({ tutorials: combined });
        },
        endTutorial: () => {
          const state = useTutorialStore.getState();
          const tutorials = {
            ...state.tutorials,
            [state.currentTutorial]: dayjs().toISOString(),
          };
          updateZeroToHero(tutorials);

          set((state) => {
            if (state.currentTutorial) {
              return {
                currentTutorial: null,
                currentStep: 0,
                tutorials,
              };
            }
            return {};
          });
        },
        nextStep: () =>
          set((state) => {
            return { currentStep: state.currentStep + 1 };
          }),
        prevStep: () =>
          set((state) => {
            return { currentStep: state.currentStep - 1 };
          }),
        goToStep: (step: number) => set({ currentStep: step }),
      }),
      {
        name: "tutorial-storage",
        version: 4,
        migrate: async (persistedState: any, version: number) => {
          if (version < 4) {
            persistedState.tutorials = Object.fromEntries(
              Object.entries(persistedState.tutorials).map(([key, value]) => [
                key,
                // @ts-expect-error
                value?.completedDate || null,
              ]),
            );
          } else {
            persistedState.tutorials = TUTORIALS;
          }
          return persistedState;
        },
      },
    ),
  ),
  shallow,
);

export function useShallowTutorialStore<S extends TutorialState, T>(
  selector: Selector<S, T>,
): T {
  return useTutorialStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}

// POC

// Instead of:
//      const { tutorials, startTutorial } = useShallowTutorialStore((state) => ({
//        tutorials: state.tutorials,
//        startTutorial: state.startTutorial,
//      }));

// We can use:
//      const { tutorials, startTutorial } = useShallowKeySelector("tutorials","startTutorial");
//
export function useShallowKeySelector<S extends TutorialState, K extends keyof S>(
  ...selector: KeySelector<S, K>[]
): Pick<S, K> {
  return useTutorialStore(
    useShallow((state: S) => {
      const result: any = {};
      for (const key of selector) {
        result[key] = state[key];
      }
      return result;
    }),
  );
}
