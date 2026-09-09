import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Navigate } from "react-router-dom";
import { AppsTab } from "~/components/AdminMarketplace/AppsTab";
import { WhitelistTab } from "~/components/AdminMarketplace/WhitelistTab";
import BrandedLoadingState from "~/components/General/BrandedLoadingState";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import { useIsMarketplaceAdmin } from "~/hooks/useAdminMarketplace";

const TABS = [
  { label: "Apps", id: "apps", disabled: false },
  { label: "Whitelist", id: "whitelist", disabled: false },
];

export default function AdminMarketplace() {
  const { isMarketplaceAdmin, isLoading } = useIsMarketplaceAdmin();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-page">
        <BrandedLoadingState />
      </div>
    );
  }

  if (!isMarketplaceAdmin) return <Navigate to="/admin" />;

  return (
    <SettingsLayout title="Marketplace" tabs={TABS} defaultTab="apps">
      <TabsPrimitive.Content value="apps" className="outline-none">
        <AppsTab />
      </TabsPrimitive.Content>
      <TabsPrimitive.Content value="whitelist" className="outline-none">
        <WhitelistTab />
      </TabsPrimitive.Content>
    </SettingsLayout>
  );
}
