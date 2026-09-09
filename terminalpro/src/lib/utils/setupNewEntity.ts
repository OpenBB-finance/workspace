import { v4 as uuidv4 } from "uuid";
import { putTier } from "~/api/auth.api";
import type { Ticker } from "~/components/types";
import { DEFAULT_MCP_SERVER } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import type { AppState, Items } from "~/lib/state/app";
import { useFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useMcpToolsStore } from "~/lib/state/mcpTools";
import { handleTemplatesCreation } from "~/lib/utils/createTemplates";

export async function setupNewEntity(params: {
  defaultTicker: Ticker;
  addTab: AppState["addTab"];
  items: Items;
  updateOnlyItems: AppState["updateOnlyItems"];
}): Promise<{ success: boolean; onboardingId?: string }> {
  const { defaultTicker, addTab, items, updateOnlyItems } = params;

  const res = await putTier({ tier: "terminal" });
  if (!res.success) {
    return { success: false };
  }

  useFeatureFlagsStore.getState().setFeatureFlagsAndUsage(
    {
      ...res.entitlement,
      is_trial: res.is_trial_entity,
      // /pro/tier omits this per-user flag; preserve it across the tier change
      can_submit_marketplace:
        useFeatureFlagsStore.getState().featureFlags?.can_submit_marketplace ?? false,
    },
    res.usage,
  );

  const rootFolder = items
    ? Object.values(items).find((item) => item.isRoot)
    : undefined;

  if (!rootFolder) {
    const rootId = uuidv4();
    updateOnlyItems({
      [rootId]: {
        index: rootId,
        name: "root",
        isFolder: true,
        isRoot: true,
        children: [],
        data: { name: "root" },
      },
    });
  }

  const onboardingId = handleTemplatesCreation(
    res.entitlement.data_bundle_info,
    defaultTicker,
    addTab,
    items,
  );

  if (getConfig().mcp.defaultServerEnabled) {
    const currentServers = useMcpToolsStore.getState().servers;
    const hasDefaultServer = currentServers.some(
      (s) => s.id === "openbb-docs-default" || s.url === DEFAULT_MCP_SERVER.url,
    );
    if (!hasDefaultServer) {
      useMcpToolsStore.getState().addServer(DEFAULT_MCP_SERVER);
    }
  }

  return { success: true, onboardingId };
}
