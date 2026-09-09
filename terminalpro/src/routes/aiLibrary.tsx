import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useMemo } from "react";
import { AIAgentsTab } from "~/components/AI/AIAgentsTab";
import { MCPServersTab } from "~/components/AI/MCPServersTab";
import { PromptsTab } from "~/components/AI/PromptsTab";
import { SkillsTab } from "~/components/AI/SkillsTab";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import { inSnowflakeNativeApp } from "~/lib/constants";

const AI_TABS = [
  { label: "AI Agents", id: "ai-agents", hideInSnowflake: true },
  { label: "MCP Servers", id: "mcp-servers", hideInSnowflake: true },
  { label: "Skills", id: "skills" },
  { label: "Prompts", id: "prompts" },
];

export default function AILibrary() {
  const visibleTabs = useMemo(
    () => AI_TABS.filter((tab) => !(inSnowflakeNativeApp && tab.hideInSnowflake)),
    [],
  );

  const defaultTab = inSnowflakeNativeApp ? "skills" : "ai-agents";

  return (
    <SettingsLayout title="AI Library" tabs={visibleTabs} defaultTab={defaultTab}>
      {!inSnowflakeNativeApp && (
        <TabsPrimitive.Content
          value="ai-agents"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <AIAgentsTab />
        </TabsPrimitive.Content>
      )}
      {!inSnowflakeNativeApp && (
        <TabsPrimitive.Content
          value="mcp-servers"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <MCPServersTab />
        </TabsPrimitive.Content>
      )}
      <TabsPrimitive.Content
        value="skills"
        forceMount
        className="data-[state=inactive]:hidden"
      >
        <SkillsTab />
      </TabsPrimitive.Content>
      <TabsPrimitive.Content
        value="prompts"
        forceMount
        className="data-[state=inactive]:hidden"
      >
        <PromptsTab />
      </TabsPrimitive.Content>
    </SettingsLayout>
  );
}
