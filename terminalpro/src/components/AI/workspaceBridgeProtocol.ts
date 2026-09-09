import type {
  AddGenerativeWidgetInputArgumentsT,
  AssignTasksToAgentInputArgumentsT,
  GetParamOptionsInputArgumentsT,
  GetWidgetDataInputArgumentsT,
  ManageNavigationBarInputArgumentsT,
} from "~/lib/utils/ai";

export type BridgeErrorCode =
  | "invalid_request"
  | "unavailable"
  | "timeout"
  | "command_failed"
  | "unknown";

export type WorkspaceWidgetConfig = {
  data_args?: Record<string, unknown> | null;
  ui_args?: Record<string, unknown> | null;
};

type CommandBase<T extends string = string> = {
  command: T;
  request_id?: string | null;
};

export type GetWorkspaceSnapshotCommand = CommandBase<"get_workspace_snapshot">;

export type GetWidgetDataCommand = CommandBase<"get_widget_data"> & {
  data_sources?: GetWidgetDataInputArgumentsT["data_sources"] | null;
};

export type ListAvailableWidgetsCommand = CommandBase<"list_available_widgets"> & {
  origin?: string | null;
  backend_id?: string | null;
};

export type GetWidgetSchemaCommand = CommandBase<"get_widget_schema"> & {
  origin?: string | null;
  widget_id?: string | null;
};

export type GetParamsOptionsCommand = CommandBase<"get_params_options"> & {
  param_options_queries?:
    | GetParamOptionsInputArgumentsT["param_options_queries"]
    | null;
};

export type ReadWidgetCommand = CommandBase<"read_widget"> & {
  dashboard_id?: string | null;
  widget_uuid?: string | null;
  widget_id?: string | null;
};

export type CreateWidgetCommand = CommandBase<"create_widget"> & {
  dashboard_id?: string | null;
  backend_name?: string | null;
  widget_id?: string | null;
  config?: WorkspaceWidgetConfig | null;
  dry_run?: boolean | null;
};

export type UpdateWidgetCommand = CommandBase<"update_widget"> & {
  dashboard_id?: string | null;
  widget_uuid?: string | null;
  widget_id?: string | null;
  config?: WorkspaceWidgetConfig | null;
  dry_run?: boolean | null;
};

export type DeleteWidgetCommand = CommandBase<"delete_widget"> & {
  dashboard_id?: string | null;
  widget_uuid?: string | null;
  widget_id?: string | null;
};

export type ManageDashboardCommand = CommandBase<"manage_dashboard"> & {
  operation?: "create" | "read" | "update" | null;
  dashboard_id?: string | null;
  name?: string | null;
  activate?: boolean | null;
};

export type UpdateDashboardLayoutCommand = CommandBase<"update_dashboard_layout"> & {
  dashboard_id?: string | null;
  widget_uuid?: string | null;
  widget_id?: string | null;
  tab_id?: string | null;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  min_w?: number | null;
  min_h?: number | null;
  max_w?: number | null;
  max_h?: number | null;
};

export type ManageNavigationBarCommand = CommandBase<"manage_navigation_bar"> &
  ManageNavigationBarInputArgumentsT & {
    dashboard_id?: string | null;
  };

export type AddGenerativeWidgetCommand = CommandBase<"add_generative_widget"> &
  AddGenerativeWidgetInputArgumentsT & {
    dashboard_id?: string | null;
  };

export type AssignTasksToAgentsCommand = CommandBase<"assign_tasks_to_agents"> & {
  task_requests?: AssignTasksToAgentInputArgumentsT["task_requests"] | null;
};

export type ExecuteAgentToolCommand = CommandBase<"execute_agent_tool"> & {
  server_id?: string | null;
  tool_name?: string | null;
  parameters?: Record<string, unknown> | null;
};

export type GetSkillContentCommand = CommandBase<"get_skill_content"> & {
  slug?: string | null;
  reason?: string | null;
};

export type NavigateWorkspaceCommand = CommandBase<"navigate_workspace"> & {
  operation?: "dashboard" | "tab" | null;
  dashboard_id?: string | null;
  tab_id?: string | null;
};

export type BackendEndpointHeader = {
  key: string;
  value: string;
  location?: "headers" | "query" | null;
};

export type ManageBackendsCommand = CommandBase<"manage_backends"> & {
  operation?: "list" | "add" | "update" | "refresh" | "remove" | null;
  backend_id?: string | null;
  name?: string | null;
  url?: string | null;
  endpoint_headers?: BackendEndpointHeader[] | null;
  validate_widgets?: boolean | null;
  is_openbb_platform?: boolean | null;
};

export type ManageAppsCommand = CommandBase<"manage_apps"> & {
  operation?: "list" | "read" | "instantiate" | null;
  backend_id?: string | null;
  app_name?: string | null;
  template_id?: string | null;
  dashboard_name?: string | null;
  activate?: boolean | null;
};

export type WorkspaceBridgeCommand =
  | GetWorkspaceSnapshotCommand
  | GetWidgetDataCommand
  | ListAvailableWidgetsCommand
  | GetWidgetSchemaCommand
  | GetParamsOptionsCommand
  | ManageDashboardCommand
  | UpdateDashboardLayoutCommand
  | NavigateWorkspaceCommand
  | ReadWidgetCommand
  | CreateWidgetCommand
  | UpdateWidgetCommand
  | DeleteWidgetCommand
  | ManageNavigationBarCommand
  | AddGenerativeWidgetCommand
  | AssignTasksToAgentsCommand
  | ExecuteAgentToolCommand
  | GetSkillContentCommand
  | ManageBackendsCommand
  | ManageAppsCommand;

export type WorkspaceBridgeCommandT<T extends WorkspaceBridgeCommand["command"]> =
  Extract<WorkspaceBridgeCommand, { command: T }>;

export interface WorkspaceBridgeCommandResult {
  ok: boolean;
  command: string;
  request_id?: string | null;
  message: string;
  data?: unknown;
  warnings?: string[];
  error?: {
    code: BridgeErrorCode;
    message: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
  };
}

export interface BrowserSession {
  session_id: string;
  token: string;
  client_name: string;
  current_dashboard_id?: string | null;
  current_tab_id?: string | null;
}

export interface BrowserSessionContext {
  current_dashboard_id?: string | null;
  current_tab_id?: string | null;
}

export interface BrowserSessionStartResponse {
  session: BrowserSession;
  websocket_url: string;
}

export interface SessionReadyEvent {
  type: "session_ready";
  session: BrowserSession;
}

export interface CommandRequestEvent {
  type: "command_request";
  command: WorkspaceBridgeCommand;
}

export interface ErrorEvent {
  type: "error";
  error?: {
    message?: string;
  };
}

export interface PongEvent {
  type: "pong";
}

export type ServerEvent =
  | SessionReadyEvent
  | CommandRequestEvent
  | ErrorEvent
  | PongEvent;
export type ClientEvent =
  | { type: "ping" }
  | { type: "command_result"; result: WorkspaceBridgeCommandResult }
  | { type: "session_context_changed"; session: BrowserSessionContext };
