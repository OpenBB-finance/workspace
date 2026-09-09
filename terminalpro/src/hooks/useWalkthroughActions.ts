import type { ChartType } from "ag-grid-community";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useShallowAppWidgetsStore } from "~/components/AI/hooks/useGetAppWidgets";
import {
  dispatchCopilotCommand,
  dispatchCopilotSubmit,
} from "~/components/AI/hooks/utils";
import {
  GeneralCopilotPrompt,
  GeneralCopilotResponse,
} from "~/components/InAppOnboarding/Walkthrough/General/Description/QueryingCopilotNote";
import type { WidgetJsonT } from "~/components/types";
import { EPS_AAPL_WALKTHROUGH } from "~/lib/eps_aapl_walkthrough";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowSidebarStore } from "~/lib/state/sidebar";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useShallowWalkthroughStore } from "~/lib/state/walkthrough";
import { uuidv4 } from "~/lib/utils";

export function useWalkthroughActions() {
  const navigate = useNavigate();
  const { setShowWidgetControlsEllipsis } = useShallowThemeStore((state) => ({
    setShowWidgetControlsEllipsis: state.setShowWidgetControlsEllipsis,
  }));
  const { addWidget, getTabById } = useShallowAppStore((state) => ({
    addWidget: state.addWidget,
    getTabById: state.getTabById,
  }));
  const { getAppWidget, lastUpdated } = useShallowAppWidgetsStore((s) => ({
    lastUpdated: s.lastUpdated,
    getAppWidget: s.getAppWidget,
  }));

  const { id } = useParams();
  const toggleSelectedWidget = useShallowCopilotDataStore(
    (state) => state?.toggleSelectedWidget,
  );

  const copilotArtifact = useShallowWalkthroughStore(
    (state) => state?.copilotArtifact ?? null,
  );

  const setIsHamburgerMenuOpen = useShallowSidebarStore(
    (state) => state?.setIsHamburgerMenuOpen,
  );

  const { addChat, setCurrentChat, getChatsData } = useShallowCopilotStore((state) => ({
    addChat: state.addChat,
    setCurrentChat: state.setCurrentChat,
    getChatsData: state.getChatsData,
  }));

  const actions = useMemo(
    () => ({
      expandCopilot: () => {
        const expandButton = document.getElementById("expand-copilot-btn");
        if (expandButton) {
          expandButton.click();
        }
      },
      newCopilotChat: () => {
        const date = Date.now();
        addChat({
          uuid: uuidv4(),
          label: (() => {
            const baseLabel = "New Chat";
            let label = baseLabel;
            let counter = 1;
            const existingLabels = getChatsData().map((chat) => chat.label);
            while (existingLabels.includes(label)) {
              label = `${baseLabel} (${counter})`;
              counter++;
            }
            return label;
          })(),
          createdAt: date,
          messages: [],
          titleManuallyUpdated: false,
          titleNeedsUpdate: true,
          lastOpened: date,
        });
        setCurrentChat(date);
      },
      createEarningHistoryWidget: () => {
        const earningHistoryWidget = getAppWidget("earning_history");

        if (id && earningHistoryWidget) {
          const widget = {
            ...earningHistoryWidget,
            name: "Earnings History - Sample Widget",
            storage: {
              mockData: EPS_AAPL_WALKTHROUGH,
            },
          };
          addWidget(id, widget);
        }
        setShowWidgetControlsEllipsis(false);
      },
      addEarningHistoryWidgetToContext: () => {
        const earningHistoryWidget = getTabById(id)?.data?.widgets.find(
          (widget) => widget.widgetId === "earning_history",
        );

        if (earningHistoryWidget) {
          toggleSelectedWidget(earningHistoryWidget.id);
        }
      },
      clickHamburgerMenu: () => {
        setIsHamburgerMenuOpen(true);
      },
      askCopilotGeneralEarningSurprisePercentage: async () => {
        dispatchCopilotCommand(GeneralCopilotPrompt);
        await dispatchCopilotSubmit({
          question: GeneralCopilotPrompt,
          mockResponse: {
            messageContent: "Here's the EPS Surprise Percentage for the last 3 years",
            artifact: GeneralCopilotResponse,
          },
        });
      },
      navigateToApps: () => {
        navigate("/app");
      },
      createCopilotWidgetGeneralEarningSurprisePercentage: () => {
        const widgetTableData = {
          columns: Object.keys(copilotArtifact.content[0]),
          rowsData: copilotArtifact.content,
        };

        const widgetChartData = copilotArtifact;

        if (widgetTableData || widgetChartData) {
          const widget = {
            id: uuidv4(),
            widgetId: "copilot_table",
            name: "EPS Surprise Percentage Chart",
            description: copilotArtifact.description,
            gridData: { w: 20, h: 12 },
            data: {
              table: {
                showAll: true,
                enableCharts: true,
                chartView: { chartType: "bar" },
              },
            },
            type: "custom",
            storage: {
              ...(widgetTableData && {
                columns: widgetTableData.columns,
                rowsData: widgetTableData.rowsData,
              }),
            },
          } as WidgetJsonT;

          if (widgetChartData) {
            const chartType = widgetChartData?.chart_params?.chartType as ChartType;
            widget.data.table.chartView = {
              enabled: true,
              chartType: chartType === "bar" ? "column" : chartType,
            };
            widget.storage = {
              rowsData: widgetChartData.content,
              chartSettingsOpen: false,
            };
          }

          if (id) {
            addWidget(id, widget);
          }
        }
      },
    }),
    [
      id,
      addWidget,
      getAppWidget,
      lastUpdated,
      toggleSelectedWidget,
      copilotArtifact,
      setIsHamburgerMenuOpen,
      getTabById,
      addChat,
      setCurrentChat,
      getChatsData,
    ],
  );

  return actions;
}
