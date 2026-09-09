import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useEffect, useMemo } from "react";
import SnowflakeHide from "~/components/General/SnowflakeHide";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import { ChartSettings } from "~/components/ThemeSettings/ChartSettings";
import { GroupingSettings } from "~/components/ThemeSettings/GroupingSettings";
import { TableSettings } from "~/components/ThemeSettings/TableSettings";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { useShallowTableChartThemesStore } from "~/lib/state/tableChartThemes";

export default function AdminThemeSettings() {
  const updateThemeSettings = useShallowTableChartThemesStore(
    (state) => state.updateThemeSettings,
  );

  useEffect(() => {
    // Fetch most recent theme settings
    updateThemeSettings();
  }, []);

  const tabs = useMemo(() => {
    const allTabs = [
      { label: "Tables", id: "tables" },
      { label: "Charts", id: "charts" },
      { label: "Grouping", id: "grouping" },
    ];
    return inSnowflakeNativeApp
      ? allTabs.filter((tab) => tab.id !== "grouping")
      : allTabs;
  }, []);

  return (
    <SettingsLayout title="Theme Settings" tabs={tabs} defaultTab="tables">
      <TabsPrimitive.Content
        value="tables"
        className="p-6 text-sm only-sm:h-screen flex flex-col flex-1"
      >
        <TableSettings />
      </TabsPrimitive.Content>
      <TabsPrimitive.Content
        value="charts"
        className="p-6 text-sm only-sm:h-screen flex flex-col flex-1"
      >
        <ChartSettings />
      </TabsPrimitive.Content>
      <SnowflakeHide>
        <TabsPrimitive.Content
          value="grouping"
          className="p-6 text-sm only-sm:h-screen flex flex-col flex-1"
        >
          <GroupingSettings />
        </TabsPrimitive.Content>
      </SnowflakeHide>
    </SettingsLayout>
  );
}
