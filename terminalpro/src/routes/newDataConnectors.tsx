import * as TabsPrimitive from "@radix-ui/react-tabs";
import { MyWidgetsTab } from "~/components/DataConnectors/MyWidgetsTab";
import { PackagedDataTab } from "~/components/DataConnectors/PackagedDataTab";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { MyDataConnectorsProvider } from "~/lib/contexts/MyDataConnectorsContext";
import { getConfig } from "~/lib/runtimeConfig";

const dataShowPackageDataFF = getConfig().data.packageDataEnabled;

const TABS = [
  { label: "My Data", id: "my-data" },
  ...(dataShowPackageDataFF && !inSnowflakeNativeApp
    ? [{ label: "Sandbox Data", id: "packaged-data" }]
    : []),
];

export default function DataConnectors() {
  return (
    <SettingsLayout title="Widgets Library" tabs={TABS} defaultTab="my-data">
      <TabsPrimitive.Content value="my-data">
        <MyDataConnectorsProvider>
          <MyWidgetsTab />
        </MyDataConnectorsProvider>
      </TabsPrimitive.Content>
      {dataShowPackageDataFF && !inSnowflakeNativeApp && (
        <TabsPrimitive.Content value="packaged-data">
          <PackagedDataTab />
        </TabsPrimitive.Content>
      )}
    </SettingsLayout>
  );
}
