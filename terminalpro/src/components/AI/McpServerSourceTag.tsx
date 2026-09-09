import { memo } from "react";
import { Tag } from "~/components/ds/atoms/Tag";
import Tooltip from "~/components/Tooltip";
import type { McpServer } from "~/lib/state/mcpTools";

type McpServerSourceTagProps = {
  server: McpServer;
  className?: string;
};

/**
 * Provenance chip for MCP servers added from a marketplace app. Renders the
 * source app's vendor name; hidden for manually-added or custom-backend
 * servers, which carry no `vendorAppUuid`.
 */
export const McpServerSourceTag = memo(
  ({ server, className }: McpServerSourceTagProps) => {
    if (!server.vendorAppUuid || !server.vendorName) return null;
    return (
      <Tooltip message={`Added from the ${server.vendorName} marketplace app`}>
        <Tag color="grey" className={className}>
          {server.vendorName}
        </Tag>
      </Tooltip>
    );
  },
);

McpServerSourceTag.displayName = "McpServerSourceTag";
