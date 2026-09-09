import posthog from "posthog-js";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import {
  type DashboardTypes,
  useShallowFeatureFlagsStore,
} from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import { getAvailableTemplates } from "~/lib/templates";
import { createEquityTemplateTab } from "~/lib/utils/createTemplates";

export type TemplateT = {
  id: DashboardTypes;
  name: string;
  description: string;
  onClick: () => void;
  img: string;
};

export function useAvailableTemplates() {
  const { id } = useParams();
  const addTab = useShallowAppStore((state) => state.addTab);

  const { defaultTicker, theme } = useShallowThemeStore((state) => ({
    defaultTicker: state.defaultTicker,
    theme: state.theme,
  }));
  const navigate = useNavigate();
  const availableTemplates = useShallowFeatureFlagsStore((state) =>
    getAvailableTemplates(state.featureFlags?.data_bundle_info || null),
  );

  const TEMPLATES = useMemo(
    () =>
      [
        {
          id: "equity",
          name: "Sandbox App (FMP Data)",
          description:
            "Sandbox data from Financial Modeling Prep (FMP), added to every Workspace account by default. Explore company financials, comparisons, ownership, and events right away, no setup needed. Free data to get you started.",
          onClick: () => {
            if (posthog) {
              posthog.capture("app_opened", {
                app_id: "equity",
                app_name: "Sandbox App (FMP Data)",
                app_type: "openbb",
              });
            }
            const items = useAppStore.getState().items;
            createEquityTemplateTab(
              {
                name: defaultTicker.symbol,
              },
              {
                addTab,
                navigate,
                items,
                currentDashboard: id,
                defaultTicker,
              },
            );
          },
          img:
            theme === "light"
              ? "/assets/images/openbb_cover.png"
              : "/assets/images/openbb_cover.png",
        },
      ] as TemplateT[],
    [defaultTicker, theme, addTab, navigate, id],
  );

  return useMemo(
    () => TEMPLATES.filter((t) => availableTemplates.includes(t.id as DashboardTypes)),
    [TEMPLATES, availableTemplates],
  );
}
