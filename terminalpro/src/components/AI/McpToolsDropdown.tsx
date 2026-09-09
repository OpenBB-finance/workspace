import DOMPurify from "dompurify";
import MarkdownToJSX from "markdown-to-jsx";
import {
  type ComponentProps,
  memo,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { PopoverContent, PopoverRoot } from "~/components/ds/atoms/Popover";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import {
  dedupeIframeServersByUrl,
  type McpServer,
  useShallowMcpToolsStore,
} from "~/lib/state/mcpTools";
import { cn } from "~/lib/utils";
import { MARKDOWN_SANITIZE_CONFIG } from "~/lib/utils/sanitize";
import { DropdownMenuContentVariants } from "../ds/atoms/DropdownMenu";
import { Input } from "../ds/atoms/Input";
import { McpServerSourceTag } from "./McpServerSourceTag";
import { schemaParameters } from "./utils/mcpToolSchema";

interface McpToolsDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

const markdownOptions = {
  overrides: {
    h1: {
      component: (props: ComponentProps<"h1">) => (
        <h1 {...props} className="text-sm font-bold text-ds-text-heading mt-2 mb-1" />
      ),
    },
    h2: {
      component: (props: ComponentProps<"h2">) => (
        <h2 {...props} className="text-xs font-bold text-ds-text-heading mt-1.5 mb-1" />
      ),
    },
    h3: {
      component: (props: ComponentProps<"h3">) => (
        <h3
          {...props}
          className="text-xs font-semibold text-ds-text-subtitle mt-1 mb-0.5"
        />
      ),
    },
    p: {
      component: (props: ComponentProps<"p">) => (
        <p
          {...props}
          className="min-w-0 max-w-full whitespace-normal wrap-anywhere text-xs
          text-ds-text-caption mb-1.5 leading-relaxed"
        />
      ),
    },
    ul: {
      component: (props: ComponentProps<"ul">) => (
        <ul
          {...props}
          className="text-xs text-ds-text-caption ml-4 mb-1.5 list-disc space-y-0.5"
        />
      ),
    },
    ol: {
      component: (props: ComponentProps<"ol">) => (
        <ol
          {...props}
          className="text-xs text-ds-text-caption ml-4 mb-1.5 list-decimal space-y-0.5"
        />
      ),
    },
    li: {
      component: (props: ComponentProps<"li">) => (
        <li
          {...props}
          className="min-w-0 max-w-full whitespace-normal wrap-anywhere text-xs text-ds-text-caption"
        />
      ),
    },
    code: {
      component: (props: ComponentProps<"code">) => {
        const isInline = !props.children?.toString().includes("\n");
        return isInline ? (
          <code
            {...props}
            className="bg-general-bg-secondary px-1 py-0.5 rounded text-xs
            font-mono text-link-color whitespace-normal wrap-anywhere"
          />
        ) : (
          <code
            {...props}
            className="min-w-0 max-w-full whitespace-normal wrap-anywhere text-xs font-mono"
          />
        );
      },
    },
    pre: {
      component: (props: ComponentProps<"pre">) => (
        <pre
          {...props}
          className="bg-general-bg-secondary p-2 rounded
          text-xs font-mono text-ds-text-body my-1.5 overflow-x-hidden
          whitespace-pre-wrap wrap-anywhere"
        />
      ),
    },
    strong: {
      component: (props: ComponentProps<"strong">) => (
        <strong {...props} className="font-semibold text-ds-text-heading" />
      ),
    },
    em: {
      component: (props: ComponentProps<"em">) => <em {...props} className="italic" />,
    },
    blockquote: {
      component: (props: ComponentProps<"blockquote">) => (
        <blockquote
          {...props}
          className="border-l-2 border-link-color pl-2 text-xs text-ds-text-caption my-1.5 italic"
        />
      ),
    },
    a: {
      component: (props: ComponentProps<"a">) => (
        <a
          {...props}
          className="text-link-color hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        />
      ),
    },
  },
  forceBlock: true,
};

// Markdown tooltip renderer component - exported for reuse
export const ToolDescriptionMarkdown = ({ content }: { content: string }) => {
  const sanitizedContent = useMemo(
    () => DOMPurify.sanitize(content, MARKDOWN_SANITIZE_CONFIG),
    [content],
  );

  return (
    <div
      className="markdown-tooltip-content min-w-0 max-w-full whitespace-normal
        wrap-anywhere text-ds-text-caption"
    >
      <MarkdownToJSX options={markdownOptions}>{sanitizedContent}</MarkdownToJSX>
    </div>
  );
};

export function McpToolsDropdown({
  open,
  onOpenChange,
  children,
}: McpToolsDropdownProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { servers, getMCPConnection, mcpConnectionRegistry } = useShallowMcpToolsStore(
    (state) => ({
      servers: state.servers,
      getMCPConnection: state.getMCPConnection,
      mcpConnectionRegistry: state.mcpConnectionRegistry,
    }),
  );

  // Filter servers to only show connected ones, and filter tools based on search query
  const filteredServers = useMemo(() => {
    // First, filter to only connected servers, collapsing duplicate copies of
    // the same iframe widget into a single entry
    let processedServers = dedupeIframeServersByUrl(
      servers.filter((server) => {
        const connection = getMCPConnection(server.id);
        return connection?.state === "ready" && server.enabled;
      }),
    );

    // Apply search filter if query exists
    if (searchQuery) {
      const query = searchQuery.toLowerCase();

      processedServers = processedServers.reduce(
        (acc, server) => {
          // Check if server name matches
          const serverMatches = server.name.toLowerCase().includes(query);

          // Filter tools that match the query
          const matchingTools = server.tools.filter((tool) =>
            tool.name.toLowerCase().includes(query),
          );

          // Include server if either server name matches or has matching tools
          if (serverMatches || matchingTools.length > 0) {
            acc.push({
              ...server,
              // If server name matches, show all tools; otherwise only matching tools
              tools: serverMatches ? server.tools : matchingTools,
              // Track if this server matched by name (for UI purposes)
              matchedByName: serverMatches,
            });
          }
          return acc;
        },
        [] as (McpServer & { matchedByName?: boolean })[],
      );
    }

    return processedServers;
  }, [servers, searchQuery, getMCPConnection, mcpConnectionRegistry]);

  return (
    <PopoverRoot open={open} onOpenChange={onOpenChange}>
      {children}
      <PopoverContent
        align="start"
        side="top"
        sideOffset={4}
        className={cn(DropdownMenuContentVariants(), "w-80 p-2.5")}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex-shrink-0">
          <div
            className="flex items-center justify-between pb-2
              border-b border-surface-divider"
          >
            <div className="font-semibold text-sm text-ds-text-heading">MCP Tools</div>
            <Tooltip message="Manage MCP Servers">
              <Link
                to="/app/ai?tab=mcp-servers"
                tabIndex={0}
                aria-label="Manage MCP Servers"
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-center w-6 h-6 rounded transition-colors
                  duration-200 text-ds-text-body hover:bg-general-bg-secondary-hover
                  hover:text-ds-text-heading"
              >
                <Icon id="settings-01" className="w-4 h-4" />
              </Link>
            </Tooltip>
          </div>

          <div className="py-3">
            <Input
              type="text"
              prefix={<Icon id="search" />}
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              placeholder="Search servers and tools"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-48 -mt-2.5">
          {filteredServers.length > 0 ? (
            filteredServers.map((server) => (
              <McpServerItem
                key={server.id}
                server={server}
                searchQuery={searchQuery}
              />
            ))
          ) : (
            <div className="p-4 text-center text-ds-text-caption">
              {servers.length === 0
                ? "No MCP servers added."
                : searchQuery
                  ? `No servers or tools matching "${searchQuery}"`
                  : "No MCP servers connected."}
            </div>
          )}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

const McpServerItem = memo((props: { server: McpServer; searchQuery: string }) => {
  const { server, searchQuery } = props;
  const { connection, toggleServerTools, toggleTool } = useShallowMcpToolsStore(
    (state) => ({
      connection: state.getMCPConnection(props.server.id),
      toggleServerTools: state.toggleServerTools,
      toggleTool: state.toggleTool,
    }),
  );

  const [isCollapsed, setIsCollapsed] = useState(searchQuery === "");

  const { isConnected, checkboxState, displayToolCount, displayTotalToolCount } =
    useMemo(() => {
      const isConnected = connection?.state === "ready" && server.enabled;

      const enabledToolsCount = server.tools.filter((tool) => tool.enabled).length;
      const totalToolsCount = server.tools.length;

      let checkboxState: boolean | "indeterminate";
      if (enabledToolsCount === 0) {
        checkboxState = false;
      } else if (enabledToolsCount === totalToolsCount) {
        checkboxState = true;
      } else {
        checkboxState = "indeterminate";
      }

      const displayToolCount = enabledToolsCount;
      const displayTotalToolCount = totalToolsCount;
      return { isConnected, checkboxState, displayToolCount, displayTotalToolCount };
    }, [connection, server]);

  // Auto-expand servers when searching to show matching tools, collapse when clearing
  useEffect(() => {
    setIsCollapsed(searchQuery === "");
  }, [searchQuery]);

  return (
    <div
      key={server.id}
      // Grey out entire server section if disconnected
      className={isConnected ? "" : "opacity-50"}
    >
      <div
        className={cn("flex items-center gap-2 px-3 py-2 rounded-sm", {
          "hover:bg-general-bg-secondary-hover": isConnected,
        })}
      >
        <Tooltip
          message={
            isConnected
              ? checkboxState === true
                ? "Deselect all tools"
                : checkboxState === "indeterminate"
                  ? "Some tools selected - click to select all"
                  : "Select all tools"
              : "Server disconnected - manage connections in MCP Servers settings"
          }
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (!isConnected) return;
              const shouldSelectAll = checkboxState !== true;
              if (!searchQuery) return toggleServerTools(server.id, shouldSelectAll);
              const toolIds = server.tools.map((tool) => tool.id);
              toggleTool(server.id, toolIds, shouldSelectAll);
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && isConnected) {
                e.stopPropagation();
                const shouldSelectAll = checkboxState !== true;
                toggleServerTools(server.id, shouldSelectAll);
              }
            }}
            role="button"
            tabIndex={isConnected ? 0 : -1}
            className={cn("flex items-center", {
              "cursor-pointer": isConnected,
              "cursor-not-allowed opacity-50": !isConnected,
            })}
          >
            <Checkbox
              checked={checkboxState}
              disabled={!isConnected}
              className="pointer-events-none"
              tabIndex={-1}
            />
          </div>
        </Tooltip>

        <div
          className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
          // Always allow collapse/expand
          onClick={() => setIsCollapsed((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setIsCollapsed((prev) => !prev);
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={!isCollapsed}
        >
          <span
            className={cn("font-medium truncate text-ds-text-heading", {
              "text-ds-text-caption": !isConnected,
            })}
          >
            {server.name}
          </span>
          <span className="text-xs text-ds-text-caption">
            ({displayToolCount}/{displayTotalToolCount})
          </span>
          <McpServerSourceTag server={server} className="shrink-0" />
          <Icon
            id={isCollapsed ? "chevron-right" : "chevron-down"}
            className={cn("h-4 w-4 ml-auto text-ds-text-body", {
              "text-ds-text-caption": !isConnected,
            })}
          />
        </div>
      </div>

      {!isCollapsed && server.tools.length > 0 && (
        <div className="pl-8 pr-3 pb-1">
          <div className="space-y-1">
            {server.tools.map((tool) => (
              <McpToolItem
                key={`${server.id}-${tool.id}-item`}
                serverId={server.id}
                tool={tool}
                isConnected={isConnected}
                iframeParams={server.iframeParams}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

type McpToolItemProps = {
  serverId: string;
  tool: McpServer["tools"][number];
  isConnected: boolean;
  iframeParams?: Record<string, string>;
};

const McpToolItem = memo((props: McpToolItemProps) => {
  const { serverId, tool, isConnected, iframeParams } = props;
  const isChecked = tool.enabled;
  const toggleTool = useShallowMcpToolsStore((state) => state.toggleTool);

  const params = useMemo(
    () => schemaParameters(tool.inputSchema, iframeParams),
    [tool.inputSchema, iframeParams],
  );

  return (
    <Tooltip
      key={`${serverId}-${tool.id}-tooltip`}
      position="left"
      align="start"
      collisionPadding={12}
      className="max-h-[320px] max-w-[380px] overflow-y-auto overflow-x-hidden wrap-anywhere"
      message={
        <div className="min-w-0 max-w-md whitespace-normal wrap-anywhere">
          <div
            className="min-w-0 max-w-full whitespace-normal wrap-anywhere font-semibold
            text-ds-text-heading mb-2 text-sm"
          >
            {tool.name}
          </div>
          {tool.description && <ToolDescriptionMarkdown content={tool.description} />}
          {params.length > 0 && (
            <div
              className="min-w-0 max-w-full whitespace-normal wrap-anywhere text-xs mt-2
              pt-2 border-t border-general-border-secondary"
            >
              <div className="font-medium text-ds-text-heading mb-1">Parameters</div>
              <ul className="list-disc pl-4 space-y-1">
                {params.map((param) => (
                  <li
                    key={param.name}
                    className="min-w-0 max-w-full whitespace-normal wrap-anywhere pl-1"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <span
                        className={cn(
                          "min-w-0 max-w-full flex-1 whitespace-normal wrap-anywhere font-mono text-ds-text-body",
                          param.required && "font-semibold text-ds-text-heading",
                        )}
                      >
                        {param.name}
                        {param.defaultValue !== undefined ? (
                          <span
                            className="min-w-0 max-w-full whitespace-normal wrap-anywhere
                              font-sans text-ds-text-caption"
                          >
                            {" "}
                            (default: {param.defaultValue})
                          </span>
                        ) : null}
                      </span>
                      <span
                        className="min-w-0 max-w-[45%] shrink-0 whitespace-normal wrap-anywhere
                        font-mono text-brand-main dark:text-brand-lighter text-right"
                      >
                        {param.typeLabel}
                      </span>
                    </div>
                    {param.description && (
                      <div
                        className="min-w-0 max-w-full whitespace-normal wrap-anywhere
                        text-ds-text-caption mt-0.5 leading-snug"
                      >
                        {param.description}
                      </div>
                    )}
                    {param.currentValue !== undefined && (
                      <div
                        className="min-w-0 max-w-full whitespace-normal wrap-anywhere
                        text-ds-text-caption mt-0.5"
                      >
                        Current:{" "}
                        <span
                          className="min-w-0 max-w-full whitespace-normal wrap-anywhere
                          font-mono text-ds-text-body"
                        >
                          {param.currentValue}
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      }
    >
      <div
        onClick={() => {
          if (isConnected) {
            toggleTool(serverId, tool.id);
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && isConnected) {
            toggleTool(serverId, tool.id);
          }
        }}
        role="checkbox"
        aria-checked={isChecked}
        tabIndex={isConnected ? 0 : -1}
        className={cn("flex items-center gap-2 py-1 text-xs rounded px-1 -mx-1", {
          "hover:bg-general-bg-secondary-hover cursor-pointer": isConnected,
          "cursor-not-allowed": !isConnected,
        })}
      >
        <Checkbox
          checked={isChecked}
          disabled={!isConnected}
          className="pointer-events-none"
          tabIndex={-1}
        />
        <span
          className={cn(
            "truncate",
            isConnected ? "text-ds-text-caption" : "text-general-label-disabled",
          )}
        >
          {tool.name}
        </span>
      </div>
    </Tooltip>
  );
});
