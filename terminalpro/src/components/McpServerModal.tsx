import { zodResolver } from "@hookform/resolvers/zod";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import z from "zod";
import { Button } from "~/components/ds/atoms/Button";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import {
  type McpConnection,
  type McpServer,
  PENDING_CONNECTION_STATES,
  useShallowMcpToolsStore,
} from "~/lib/state/mcpTools";
import { EndpointHeadersForm } from "./DataConnectors/SingleWidget";
import { Checkbox } from "./ds/atoms/Checkbox";
import { FormInput, Input } from "./ds/atoms/Input";
import { Form, FormField, useForm } from "./ds/molecules/Form";
import SettingsMenu from "./ds/molecules/SettingsMenu";
import { cn } from "./ds/utils";
import SearchResultsNotFound from "./General/SearchResultsNotFound";

const ConnectionTools = memo(
  ({ serverId, searchTerm }: { serverId: string; searchTerm?: string }) => {
    const tools = useShallowMcpToolsStore(
      (state) => state.getMCPConnection(serverId)?.tools || [],
    );

    const filteredTools = useMemo(() => {
      const term = searchTerm?.trim().toLowerCase();
      if (!term) return tools;
      return tools.filter(
        (tool) =>
          tool?.name?.toLowerCase()?.includes(term) ||
          tool?.description?.toLowerCase()?.includes(term),
      );
    }, [tools, searchTerm]);

    if (filteredTools.length === 0) {
      return (
        <div className="body-xs-regular text-ds-text-caption text-center py-2">
          No tools match your search
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredTools.map((tool, index) => (
          <ToolItem key={`${tool.name}-${index}`} tool={tool} />
        ))}
      </div>
    );
  },
);

const ToolItem = memo(({ tool }: { tool: { name: string; description?: string } }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDescription = Boolean(tool.description);

  return (
    <div className="bg-general-bg-primary border border-general-border-primary rounded px-2.5 py-2">
      <div
        className={cn("flex items-center gap-1", hasDescription && "cursor-pointer")}
        onClick={hasDescription ? () => setIsExpanded((p) => !p) : undefined}
        role={hasDescription ? "button" : undefined}
        tabIndex={hasDescription ? 0 : undefined}
        onKeyDown={
          hasDescription
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsExpanded((p) => !p);
                }
              }
            : undefined
        }
      >
        <Icon
          id="chevron-right"
          className={cn("size-4 text-ds-text-body transition-transform", {
            "rotate-90": isExpanded,
            "opacity-0": !hasDescription,
          })}
        />
        <span className="body-xs-regular text-ds-text-heading">{tool.name}</span>
      </div>

      {hasDescription && isExpanded && (
        <>
          <div className="h-px bg-surface-divider my-2" />
          <p className="body-xs-regular text-ds-text-body whitespace-pre-wrap break-words">
            {tool.description}
          </p>
        </>
      )}
    </div>
  );
});

function getStatusProperties(state: McpConnection["state"]) {
  const getStatusColor = () => {
    switch (state) {
      case "ready":
        return "bg-alert-success";
      case "failed":
        return "bg-alert-error";
      case "discovering":
      case "connecting":
      case "authenticating":
      case "pending_auth":
        return "bg-alert-warning";
      case "disconnected":
        return "bg-light-400 dark:bg-dark-300";
      default:
        return "bg-alert-error";
    }
  };

  const getStatusText = () => {
    switch (state) {
      case "connecting":
        return "Connecting...";
      case "discovering":
        return "Discovering...";
      case "authenticating":
        return "Authenticating...";
      case "loading":
        return "Loading tools...";
      default:
        return "";
    }
  };

  const getConnectionTooltip = () => {
    switch (state) {
      case "ready":
        return "Currently connected";
      case "failed":
        return "Connection failed";
      case "authenticating":
      case "pending_auth":
        return "Authentication required";
      case "disconnected":
        return "Disconnected";
      default:
        return "Connecting...";
    }
  };

  return {
    statusColor: getStatusColor(),
    statusText: getStatusText(),
    connectionTooltip: getConnectionTooltip(),
  };
}

type McpServerConnectionProps = {
  serverId: string;
  dispatch: StateDispatch<McpServerModalState>;
  searchTerm?: string;
};

function buildFaviconUrl(serverUrl: string | undefined): string | undefined {
  if (!serverUrl) return undefined;
  try {
    const hostname = new URL(serverUrl).hostname;
    const root = hostname.split(".").slice(-2).join(".");
    return `https://${root}/favicon.ico`;
  } catch {
    return undefined;
  }
}

const McpServerConnection = memo(
  ({ serverId, dispatch, searchTerm }: McpServerConnectionProps) => {
    const { isWidgetBound, connectionState, connectionError, hasTools, server } =
      useShallowMcpToolsStore((state) => {
        const connection = state.getMCPConnection(serverId);
        const server = state.getServerById(serverId);
        return {
          connectionState: connection?.state || "disconnected",
          connectionError: connection?.error,
          hasTools: (connection?.tools?.length ?? 0) > 0,
          server,
          isWidgetBound: Boolean(server?.iframeWidgetId),
        };
      });

    const { onUpdateServer, onRemove } = useShallowMcpToolsStore((state) => ({
      onUpdateServer: state.updateServer,
      onRemove: state.removeServer,
    }));

    const faviconUrl = useMemo(() => buildFaviconUrl(server?.url), [server?.url]);

    const handleDisconnect = useCallback(
      () => onUpdateServer(serverId, { enabled: false }),
      [serverId, onUpdateServer],
    );

    const handleReconnect = useCallback(
      () => onUpdateServer(serverId, { enabled: true }),
      [serverId, onUpdateServer],
    );

    const isConnected = useMemo(
      () =>
        (PENDING_CONNECTION_STATES as readonly string[]).includes(connectionState) ||
        connectionState === "ready",
      [connectionState],
    );

    const isPending = useMemo(
      () => (PENDING_CONNECTION_STATES as readonly string[]).includes(connectionState),
      [connectionState],
    );

    const toolCount = useMemo(() => {
      const term = searchTerm?.trim().toLowerCase();
      if (!term) return server?.tools?.length || 0;
      return (
        server?.tools?.filter(
          (tool) =>
            tool?.name?.toLowerCase()?.includes(term) ||
            tool?.description?.toLowerCase()?.includes(term),
        ).length || 0
      );
    }, [server?.tools, searchTerm]);

    const status = getStatusProperties(connectionState);

    const title = (
      <div className="flex items-center gap-2.5">
        {faviconUrl && (
          <img
            src={faviconUrl}
            className="size-5 rounded-sm"
            alt={`${server?.name} favicon`}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <span className="body-xs-medium text-ds-text-heading">{server?.name}</span>
        <span className="body-xs-regular text-ds-text-caption">({toolCount})</span>
      </div>
    );

    const rightElement = (
      <div className="flex items-center gap-2">
        <Tooltip message="Edit">
          <button
            className="obb-small-navbar-btn rounded flex items-center justify-center size-6"
            onClick={() => dispatch({ editServerId: serverId })}
          >
            <Icon id="pencil-02" className="size-4" />
          </button>
        </Tooltip>
        <Tooltip message="Delete">
          <button
            className="obb-small-navbar-btn rounded flex items-center justify-center size-6"
            onClick={() => server?.id && onRemove(server.id)}
          >
            <Icon id="trash-04" className="size-4" />
          </button>
        </Tooltip>
        <div className="flex items-center gap-2 pl-2 border-l border-surface-divider">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {!isWidgetBound && (
              <div
                className="group-hover:opacity-100 flex items-center gap-2 opacity-0
                border-r border-light-200 pr-2 dark:border-dark-500 transition-opacity duration-200"
              >
                <Tooltip message="Delete">
                  <button
                    className="obb-small-navbar-btn rounded flex items-center justify-center size-5"
                    onClick={() => onRemove(server.id)}
                  >
                    <Icon id="trash-04" className="size-4" />
                  </button>
                </Tooltip>
                <Tooltip message="Edit">
                  <button
                    className="obb-small-navbar-btn rounded flex items-center justify-center size-5"
                    onClick={() => dispatch({ editServerId: serverId })}
                  >
                    <Icon id="pencil-02" className="size-4" />
                  </button>
                </Tooltip>
              </div>
            )}
            {status.statusText && (
              <span className="body-xs-regular text-ds-text-caption">
                {status.statusText}
              </span>
            )}
            {isPending ? (
              <Icon
                id="mdi-loading"
                className="size-3 animate-spin text-alert-warning"
              />
            ) : (
              <Tooltip
                message={
                  <div className="flex flex-col items-center max-w-[250px] break-words">
                    <span>{status.connectionTooltip}</span>
                    {connectionError && (
                      <span className="text-alert-warning body-xs-regular mt-1">
                        {connectionError}
                      </span>
                    )}
                  </div>
                }
                position="top"
              >
                <div className={cn("size-2 rounded-full", status.statusColor)} />
              </Tooltip>
            )}

            <Button
              onClick={isConnected ? handleDisconnect : handleReconnect}
              variant="outlined"
              size="xs"
            >
              {isConnected ? "Disconnect" : "Connect"}
            </Button>
          </div>
        </div>
      </div>
    );

    return (
      <SettingsMenu canCollapse title={title} rightElement={rightElement}>
        {isConnected && hasTools ? (
          <ConnectionTools serverId={serverId} searchTerm={searchTerm} />
        ) : (
          <p className="body-xs-regular text-ds-text-caption text-center py-2">
            Connect to the MCP server to discover available tools.
          </p>
        )}
      </SettingsMenu>
    );
  },
);

interface McpServerModalProps {
  open: boolean;
  onClose: () => void;
}

type McpServerModalState = {
  addingServer: boolean;
  editServerId: string | null;
  searchTerm: string;
};

const mcpServerSchema = z.object({
  name: z.string().min(1, "Server name is required"),
  url: z.url("Invalid URL format").min(1, "URL is required"),
  clientName: z.string().optional(),
  isLocal: z.boolean().optional(),
  customHeaders: z
    .array(
      z.object({
        key: z.string().min(1, "Header key is required"),
        value: z.string().min(1, "Header value is required"),
      }),
    )
    .default([]),
});

export type McpServerSchema = z.infer<typeof mcpServerSchema>;
export type NewMcpServer = McpServerSchema;

export const McpServerModal = memo(({ onClose }: Omit<McpServerModalProps, "open">) => {
  const servers = useShallowMcpToolsStore((state) => state.servers);

  const [state, dispatch] = useStateReducer<McpServerModalState>({
    addingServer: false,
    editServerId: null,
    searchTerm: "",
  });

  const filteredServerIds = useMemo(() => {
    const term = state.searchTerm.trim().toLowerCase();
    if (!term) return servers.map((server) => server.id);

    return servers
      .filter((server) => {
        const serverMatches =
          server?.name?.toLowerCase()?.includes(term) ||
          server?.url?.toLowerCase()?.includes(term);

        const hasMatchingTools = server?.tools?.some(
          (tool) =>
            tool?.name?.toLowerCase()?.includes(term) ||
            tool?.description?.toLowerCase()?.includes(term),
        );

        return serverMatches || hasMatchingTools;
      })
      .map((server) => server.id);
  }, [servers, state.searchTerm]);

  const handleSearchChange = useCallback(
    (searchTerm: string) => dispatch({ searchTerm }),
    [dispatch],
  );

  return (
    <>
      <BaseDialog
        open={true}
        onClose={onClose}
        className="w-[731px] max-w-[731px] sm:max-w-[90vw] md:max-w-[95vw] lg:max-w-3xl xl:max-w-4xl h-auto max-h-[90vh] sm:max-h-[85vh] md:max-h-[80vh] lg:max-h-[783px]"
      >
        <DialogHeader>
          <DialogTitle>MCP Servers</DialogTitle>
          <DialogDescription>
            Test connections to your MCP servers and discover available tools. Supports
            HTTP/SSE protocols only (stdio protocol is not supported).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-full min-h-0 gap-3.5 mt-1">
          <div className="flex items-center justify-between gap-3 flex-shrink-0">
            <Input
              placeholder="Search servers, tools, or descriptions..."
              size="sm"
              className="w-full max-w-sm"
              value={state.searchTerm}
              onChange={handleSearchChange}
              prefix={<Icon id="search" className="size-4" />}
            />
            <Button
              onClick={() => dispatch({ addingServer: true })}
              variant="primary"
              size="sm"
            >
              <Icon id="plus-icon" className="size-4" />
              Add Server
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {filteredServerIds.length > 0 ? (
              <div className="space-y-3">
                {filteredServerIds.map((serverId) => (
                  <McpServerConnection
                    key={serverId}
                    serverId={serverId}
                    dispatch={dispatch}
                    searchTerm={state.searchTerm}
                  />
                ))}
              </div>
            ) : servers.length === 0 ? (
              <SearchResultsNotFound
                icon={false}
                firstMessage="No MCP servers added"
                secondMessage={
                  <>
                    You haven't added any MCP server URLs yet.{" "}
                    <a
                      href="https://docs.openbb.co/workspace/analysts/ai-features/mcp-tools"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="obb-hyper-link"
                    >
                      Read the MCP tools guide
                    </a>
                  </>
                }
                extraClassName="flex-1 flex flex-col gap-2 bg-general-bg-secondary rounded py-2.5"
              />
            ) : (
              <SearchResultsNotFound
                icon={true}
                firstMessage="No results found"
                secondMessage="Try adjusting your search criteria."
                extraClassName="flex-1 flex flex-col gap-2 bg-general-bg-secondary rounded py-2.5"
              />
            )}
          </div>
        </div>
      </BaseDialog>
      <ManageMcpServer
        open={state.addingServer}
        onClose={() => dispatch({ addingServer: false, editServerId: null })}
        existingServerId={state.editServerId}
      />
    </>
  );
});

interface ManageMcpServerProps extends McpServerModalProps {
  existingServerId?: string;
}

const initialState = { name: "", url: "", clientName: "", customHeaders: [] };

export function ManageMcpServer(props: ManageMcpServerProps) {
  const { onClose, existingServerId } = props;

  const isOpen = useMemo(
    () => Boolean(existingServerId || props.open),
    [existingServerId, props.open],
  );

  const { serverToEdit, addServer, updateServer } = useShallowMcpToolsStore(
    (state) => ({
      serverToEdit: existingServerId ? state.getServerById(existingServerId) : null,
      addServer: state.addServer,
      updateServer: state.updateServer,
    }),
  );

  const form = useForm({
    resolver: zodResolver(mcpServerSchema),
    defaultValues: {
      name: serverToEdit?.name || "",
      url: serverToEdit?.url || "",
      clientName: serverToEdit?.clientName || "",
      isLocal: serverToEdit?.isLocal,
      customHeaders: [],
    },
  });

  const handleSave = useCallback(
    (server: McpServerSchema) => {
      const newServerData = {
        name: server.name.trim(),
        clientName: server.clientName.trim(),
        isLocal: server.isLocal,
        url: server.url.trim(),
        customHeaders: undefined,
      } as McpServer;

      if (server.customHeaders?.length > 0) {
        const headersObject: Record<string, string> = {};
        for (const header of server.customHeaders) {
          if (header.key.trim() && header.value.trim()) {
            headersObject[header.key.trim()] = header.value.trim();
          }
        }
        newServerData.customHeaders = headersObject;
      }
      try {
        if (existingServerId) {
          updateServer(existingServerId, newServerData, true);
        } else {
          addServer({
            id: Date.now().toString(),
            enabled: true,
            tools: [],
            ...newServerData,
          });
        }

        form.reset(initialState);
      } catch (error) {
        console.error("Invalid server configuration:", error);
      }

      onClose();
    },
    [form.reset, existingServerId, addServer, updateServer, onClose],
  );

  useEffect(() => {
    if (existingServerId && serverToEdit) {
      form.reset({
        name: serverToEdit.name,
        url: serverToEdit.url,
        clientName: serverToEdit.clientName || "",
        isLocal: serverToEdit.isLocal,
        customHeaders: Object.entries(serverToEdit.customHeaders || {}).map(
          ([key, value]) => ({ key, value }),
        ),
      });
    } else {
      form.reset(initialState);
    }
  }, [serverToEdit]);

  const handleAddPair = useCallback(() => {
    const endpointHeaders = form.getValues("customHeaders");
    form.setValue(
      "customHeaders",
      [...(endpointHeaders || []), { key: "", value: "" }],
      { shouldValidate: false },
    );
  }, [form.getValues, form.setValue]);

  return (
    <BaseDialog
      open={isOpen}
      onClose={onClose}
      className="w-[660px] max-w-[660px] !z-60"
    >
      <DialogHeader>
        <DialogTitle>
          {existingServerId ? "Edit MCP Server" : "Add MCP Server"}
        </DialogTitle>
        <DialogDescription>
          {existingServerId
            ? "Update your MCP server details. Supports streamable HTTP only (stdio and SSE are not supported)."
            : "Connect OpenBB Workspace to your data and tools. Supports streamable HTTP only (stdio and SSE are not supported)."}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSave)} className="flex flex-col gap-3">
          <FormField
            name="name"
            control={form.control}
            render={({ field }) => (
              <FormInput label="Name" placeholder="Name" {...field} />
            )}
          />
          <FormField
            name="url"
            control={form.control}
            render={({ field }) => (
              <FormInput
                label="URL"
                placeholder="Remote MCP server URL"
                {...field}
                onBlur={(e) =>
                  form.setValue("url", e.target.value.trim(), {
                    shouldValidate: e.target.value.trim() !== "",
                  })
                }
              />
            )}
          />
          <FormField
            name="clientName"
            control={form.control}
            render={({ field, fieldState }) => (
              <FormInput
                label="Client Name (Optional)"
                placeholder="OpenBB Workspace"
                {...field}
                message={fieldState.error?.message}
              />
            )}
          />
          <FormField
            name="isLocal"
            control={form.control}
            render={({ field }) => (
              <div className="flex items-center gap-1.5 body-xs-regular">
                <Checkbox
                  label={<span className="whitespace-nowrap">Local Server</span>}
                  className="text-ds-text-body whitespace-nowrap [&_label]:-mt-1"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Tooltip
                  message="Enable this if the MCP server is running on localhost or within the same network."
                  className="max-w-[300px] break-words"
                  position="top"
                >
                  <span>
                    <Icon
                      id="help-outline-circle"
                      className="inline text-ds-text-caption"
                    />
                  </span>
                </Tooltip>
              </div>
            )}
          />

          <div className="overflow-y-auto max-h-[200px] pr-1">
            <EndpointHeadersForm name="customHeaders" />
          </div>
        </form>
      </Form>

      <DialogFooter className="flex justify-between">
        <Button type="button" onClick={handleAddPair} variant="outlined" size="sm">
          <Icon id="plus-icon" className="size-4" />
          Add Custom Header
        </Button>
        <div className="flex gap-2">
          <Button onClick={onClose} variant="outlined" size="sm">
            Cancel
          </Button>
          <Button
            onClick={form.handleSubmit(handleSave)}
            disabled={
              !(form.formState.isValid || existingServerId) ||
              form.formState.isSubmitting ||
              (existingServerId && !form.formState.isDirty)
            }
            size="sm"
          >
            {existingServerId ? "Update" : "Add"}
          </Button>
        </div>
      </DialogFooter>
    </BaseDialog>
  );
}
