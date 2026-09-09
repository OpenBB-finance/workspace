import { z } from "zod";
import type { Chat, ToolMessage } from "../state/copilot";

const dataSource = z.object({
  widget_uuid: z.string().nullish(),
  origin: z.string(),
  id: z.string(),
  input_args: z.record(z.string(), z.any().nullish()),
  ssm_request: z.record(z.string(), z.any().nullish()).nullish(),
});

const paramOptionQuery = z.object({
  origin: z.string(),
  id: z.string(),
  options_endpoint_input_args: z.record(z.string(), z.any()),
  param: z.string(),
});

export const paramOptionSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export const paramOptionQueryResult = z.object({
  param_options: z.array(
    z.object({
      param: z.string(),
      options: z.array(paramOptionSchema),
    }),
  ),
});

export const getWidgetDataInputArguments = z.object({
  data_sources: z.array(dataSource),
});

export const getParamOptionsInputArguments = z.object({
  param_options_queries: z.array(paramOptionQuery),
});

const taskRequestsSchema = z.object({
  id: z.string(),
  description: z.string(),
  assigned_holder_url: z.string(),
  assigned_agent_id: z.string(),
});

export const assignTasksToAgentInputArguments = z.object({
  task_requests: z.array(taskRequestsSchema),
});

export const addGenerativeWidgetInputArguments = z
  .object({
    widget_type: z.enum(["chart", "table", "note", "html"]),
    data: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]),
    name: z.string(),
    description: z.string().nullish(),
    chart_params: z
      .object({
        chartType: z.string(),
        xKey: z.string(),
        yKey: z.array(z.string()).min(1),
        angleKey: z.string().optional(),
        calloutLabelKey: z.string().optional(),
      })
      .nullish(),
    inner_tab: z.string().nullish(),
    citations: z.array(z.any()).optional(),
    artifacts: z.array(z.any()).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.widget_type === "note" || value.widget_type === "html") &&
      typeof value.data !== "string"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["data"],
        message: `${value.widget_type} widgets require data as a string.`,
      });
    }
    if (
      (value.widget_type === "table" || value.widget_type === "chart") &&
      !Array.isArray(value.data)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["data"],
        message: `${value.widget_type} widgets require data as an array of objects.`,
      });
    }
    if (value.widget_type === "chart" && !value.chart_params) {
      ctx.addIssue({
        code: "custom",
        path: ["chart_params"],
        message:
          "chart widgets require chart_params with chartType, xKey, and a non-empty yKey.",
      });
    }
  });

export const manageNavigationBarInputArguments = z.discriminatedUnion("operation", [
  z.object({
    operation: z.enum(["create", "add_tabs", "remove_tabs"]),
    tabs: z.array(z.object({ name: z.string() })),
  }),
  z.object({
    operation: z.literal("rename_tabs"),
    rename_map: z.record(z.string(), z.string()),
  }),
]);

export const GET_WIDGET_DATA_FUNCTIONS = [
  "get_widget_data",
  "get_extra_widget_data",
] as const;
export const AVAILABLE_FUNCTIONS = [
  ...GET_WIDGET_DATA_FUNCTIONS,
  "get_params_options",
  "add_widget_to_dashboard",
  "add_generative_widget",
  "update_widget_in_dashboard",
  "assign_tasks_to_agents",
  "execute_agent_tool",
  "manage_navigation_bar",
  "get_skill_content",
  "save_skill",
] as const;

export function isWidgetDataFunctionCall<T extends ToolMessage | FunctionCallT>(
  message: T,
): message is T & FunctionCallT {
  return GET_WIDGET_DATA_FUNCTIONS.includes(message.function as any);
}

export const functionCallSchema = z
  .object({
    function: z.enum(AVAILABLE_FUNCTIONS),
    input_arguments: z
      .union([z.any(), getWidgetDataInputArguments, getParamOptionsInputArguments])
      .optional(),
    extra_state: z.any(),
  })
  .refine(
    (data) => {
      const func = data.function;
      const inputArgs = data.input_arguments as FunctionCallT["input_arguments"];
      if (
        (func === "get_widget_data" || func === "get_extra_widget_data") &&
        getWidgetDataInputArguments.safeParse(inputArgs).success
      ) {
        return true;
      }
      if (
        func === "get_params_options" &&
        getParamOptionsInputArguments.safeParse(inputArgs).success
      ) {
        return true;
      }
      if (func === "add_widget_to_dashboard") {
        return true; // TODO: Add validation for add_widget_to_dashboard
      }
      if (
        func === "add_generative_widget" &&
        addGenerativeWidgetInputArguments.safeParse(inputArgs).success
      ) {
        return true;
      }
      if (func === "update_widget_in_dashboard") {
        return true; // TODO: Add validation for update_widget_in_dashboard
      }
      if (
        func === "assign_tasks_to_agents" &&
        assignTasksToAgentInputArguments.safeParse(inputArgs).success
      ) {
        return true;
      }
      if (func === "execute_agent_tool") {
        // Validate that we have tool_name and parameters
        return (
          inputArgs &&
          typeof inputArgs.server_id === "string" &&
          typeof inputArgs.tool_name === "string" &&
          inputArgs.parameters !== undefined
        );
      }
      if (
        func === "manage_navigation_bar" &&
        manageNavigationBarInputArguments.safeParse(inputArgs).success
      ) {
        return true;
      }
      if (func === "get_skill_content") {
        // Validate that we have slug
        return inputArgs && typeof inputArgs.slug === "string";
      }
      if (func === "save_skill") {
        // Both name and instructions are optional
        return true;
      }
      return false;
    },
    {
      message: "Invalid input_arguments for the specified function",
    },
  );

export type DataSourceT = z.infer<typeof dataSource>;
export type ParamOptionQueryT = z.infer<typeof paramOptionQuery>;
export type ParamOptionSchemaT = z.infer<typeof paramOptionSchema>;
export type ParamOptionQueryResultT = z.infer<typeof paramOptionQueryResult>;
export type GetWidgetDataInputArgumentsT = z.infer<typeof getWidgetDataInputArguments>;
export type GetParamOptionsInputArgumentsT = z.infer<
  typeof getParamOptionsInputArguments
>;
export type AssignTasksToAgentInputArgumentsT = z.infer<
  typeof assignTasksToAgentInputArguments
>;
export type TaskRequest = z.infer<typeof taskRequestsSchema>;
export type AddGenerativeWidgetInputArgumentsT = z.infer<
  typeof addGenerativeWidgetInputArguments
>;
export type ManageNavigationBarInputArgumentsT = z.infer<
  typeof manageNavigationBarInputArguments
>;

export type FunctionCallSchemaT = z.infer<typeof functionCallSchema>;

type WidgetQueryRequest = {
  widget_uuid: string;
  does_query_match_input_args: string | null;
  use_current_inputs: boolean;
  query: string;
};

type DataSourceSearchQuery = {
  description: string;
  query: string;
  user_context: string | null;
};

export type CopilotFunctionCallArgumentsT = {
  summary?: string;
  widget_queries?: WidgetQueryRequest[];
  search_queries?: DataSourceSearchQuery[];
  widget_type?: AddGenerativeWidgetInputArgumentsT["widget_type"];
  name?: string;
  description?: string | null;
  chart_params?: AddGenerativeWidgetInputArgumentsT["chart_params"];
};

type ExtraState = {
  copilot_function_call_arguments?: CopilotFunctionCallArgumentsT;
  expect_direct_response?: boolean;
};

type MCPToolInputArgumentsT = {
  server_id?: string;
  tool_name?: string;
  parameters?: Record<string, any>;
};

type GetSkillContentInputArgumentsT = {
  slug?: string;
  reason?: string;
};

export type SaveSkillInputArgumentsT = {
  name?: string | null;
  instructions?: string | null;
};

type InputArgumentsT = Partial<
  GetWidgetDataInputArgumentsT &
    GetParamOptionsInputArgumentsT &
    MCPToolInputArgumentsT &
    AssignTasksToAgentInputArgumentsT &
    ManageNavigationBarInputArgumentsT &
    AddGenerativeWidgetInputArgumentsT &
    GetSkillContentInputArgumentsT &
    SaveSkillInputArgumentsT
>;

export type FunctionCallT = {
  function: FunctionCallSchemaT["function"];
  input_arguments: InputArgumentsT;
  copilot_function_call_arguments?: ExtraState["copilot_function_call_arguments"];
  extra_state: ExtraState;
};

export async function handleStreamingResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  updateData: (chunk: string) => void,
  onDone?: (accumulated: string) => void,
  signal?: AbortSignal,
) {
  const decoder = new TextDecoder("utf-8");

  async function read(accumulated = "") {
    if (signal?.aborted) {
      // If the request has been aborted, exit the function
      if (onDone) {
        onDone(accumulated);
      }
      return;
    }
    const { done, value } = await reader.read();
    const chunk = decoder.decode(value, { stream: true });

    accumulated += chunk;
    if (updateData) {
      updateData(chunk);
    }

    if (done) {
      if (onDone) {
        onDone(accumulated);
      }
      return;
    }
    return read(accumulated);
  }
  return read();
}

export function migrateFuncCallArgs(
  message: Partial<
    ToolMessage & {
      input_arguments?: { widget_uuid?: string; id?: string };
      copilot_function_call_arguments?: {
        widget_uuid?: string;
        data_source_description?: string;
        query?: string;
      };
    }
  >,
) {
  try {
    if (message?.function === "get_widget_data") {
      const inputArgs = message.input_arguments;
      const copilotArgs = message.copilot_function_call_arguments;

      if (inputArgs?.widget_uuid || inputArgs?.id) {
        inputArgs.widget_uuids = [inputArgs.widget_uuid || inputArgs.id];
        inputArgs.widget_uuid = undefined;
        message.input_arguments = inputArgs;
      }

      if (copilotArgs?.widget_uuid) {
        // @ts-expect-error
        copilotArgs.widget_uuids = [copilotArgs.widget_uuid];
        copilotArgs.widget_uuid = undefined;
        message.copilot_function_call_arguments = copilotArgs;
      }
    }

    // @ts-expect-error
    if (message?.function === "get_direct_retrieval_data") {
      const inputArgs = message.input_arguments;
      const copilotArgs = message.copilot_function_call_arguments;

      if (inputArgs?.id && inputArgs?.origin && inputArgs?.input_args) {
        message.input_arguments = {
          data_sources: [message?.input_arguments as any],
        };
      }

      if (copilotArgs?.data_source_description && copilotArgs?.query) {
        message.copilot_function_call_arguments = {
          // @ts-expect-error
          data_source_search_queries: [
            {
              data_source_description: copilotArgs.data_source_description,
              query: copilotArgs.query,
            },
          ],
        };
      }
    }
  } catch (e) {
    console.error(e);
    // Ignore errors
  }

  return message;
}

export function mergeDuplicateChats(chatGroup: Chat[]) {
  const mergedChat = chatGroup.reduce(
    (acc, chat) => {
      acc.messages = [...acc.messages, ...chat.messages];
      acc.artifacts = [...(acc.artifacts || []), ...(chat.artifacts || [])];
      return acc;
    },
    { ...chatGroup[0] },
  );

  mergedChat.messages = mergedChat.messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter(
      (message, index, self) =>
        index === self.findIndex((m) => m.timestamp === message.timestamp),
    );

  mergedChat.artifacts = mergedChat.artifacts.filter(
    (artifact, index, self) =>
      index === self.findIndex((a) => a.uuid === artifact.uuid),
  );

  return [mergedChat];
}
