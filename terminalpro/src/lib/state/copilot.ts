import type { ChartType } from "ag-grid-enterprise";
import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash.isequal";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import {
  type CustomCopilot,
  getCopilotChat,
  getExternalCopilotHolders,
} from "~/api/auth.api";
import { showDeprecatedFlagsToast } from "~/components/AI/hooks/utils";
import { getConfig } from "~/lib/runtimeConfig";
import {
  AI_SUPPORTED_FILE_TYPES,
  getDefaultCopilot,
  inSnowflakeNativeApp,
} from "../constants";
import {
  type FunctionCallSchemaT,
  mergeDuplicateChats,
  migrateFuncCallArgs,
} from "../utils";
import type { Selector } from "./app";

export const copilotSchema = z
  .object({
    holderUuid: z.string().optional(), // For external copilots
    id: z.string(),
    name: z.string(),
    description: z.string(),
    image: z.url().optional(),
    link: z.url().optional(), // What is this?
    hasStreaming: z.boolean().optional(), // Deprecated: keeping it the schema to avoid breaking changes
    hasDocuments: z.boolean().optional(), // Deprecated: not applicable anymore
    hasFunctionCalling: z.boolean().optional(), // Deprecated: use features.widget-dashboard-select, widget-dashboard-search or widget-global-search instead
    endpoints: z.object({
      upload_docs: z.url().optional(),
      query: z.url().optional(),
      feedback: z.url().optional(),
    }),
    features: z
      .record(
        z.string(),
        z.union([
          z.boolean(),
          z.object({
            label: z.string(),
            type: z.enum(["toggle", "text", "select"]).optional(),
            default: z.union([z.boolean(), z.string()]).optional(),
            description: z.string().optional(),
            placeholder: z.string().optional(),
            options: z
              .array(z.object({ label: z.string(), value: z.string() }))
              .optional(),
          }),
        ]),
      )
      .optional(),
    headers: z.record(z.string(), z.string()).optional(),
    models: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  })
  .refine((data) => {
    if (data.hasStreaming !== undefined) {
      data.features = {
        ...data.features,
        streaming: data.hasStreaming,
      };
    }
    if (data.hasFunctionCalling !== undefined) {
      data.features = {
        ...data.features,
        "widget-dashboard-select": data.hasFunctionCalling,
        "widget-dashboard-search": data.hasFunctionCalling,
        "widget-global-search": data.hasFunctionCalling,
      };
    }
    return true;
  });

export type Copilot = z.infer<typeof copilotSchema>;
export type CopilotModel = { id: string; name: string };

export interface WidgetSignature {
  origin: string;
  widgetId: string;
  args: Record<string, any>;
  ssmRequest?: Record<string, any>; // For ssrm_table widgets
}

const ParseAsTypes = [
  "html",
  "text",
  "table",
  "chart",
  "snowflake_query",
  "snowflake_python",
] as const;

type ParseAs = (typeof ParseAsTypes)[number];

interface DataFormatBase<P extends ParseAs = ParseAs> {
  data_type: "object" | (typeof AI_SUPPORTED_FILE_TYPES)[number];
  filename?: string;
  parse_as?: P;
}

interface DataFormatChart extends DataFormatBase<"chart"> {
  chart_params?: {
    chartType: ChartType;
    xKey: string;
    yKey: string[];
    labelKey?: string;
    labelName?: string;
  };
}

interface DataFormatSnowflake
  extends DataFormatBase<"snowflake_query" | "snowflake_python"> {
  query_data_source: {
    origin: string;
    id: string;
    widget_uuid: string;
  };
}

export type DataFormat = DataFormatBase | DataFormatChart | DataFormatSnowflake;

export interface DataContent {
  content: string;
  data_format?: DataFormat;
}

export interface DataUrl {
  url: string;
  data_format?: DataFormat;
  expiration?: number; // Unix timestamp
}

export enum CopilotErrorType {
  NOT_FOUND = "not_found", // For missing widgets, files, params, endpoints
  GATEWAY_ERROR = "gateway_error", // For network errors, external server errors
  UNEXPECTED = "unexpected_error", // For catch-all unexpected errors
}

export interface CopilotFunctionCallError {
  error_type: CopilotErrorType;
  content: string;
}

export class CopilotError extends Error {
  error_type: string;
  content: string;

  constructor(error_type: CopilotErrorType, content: string) {
    super(content);
    this.name = "CopilotError";
    this.error_type = error_type;
    this.content = content;
  }
}

const SourceInfoSchema = z.object({
  type: z.string(),
  name: z.string(),
  origin: z.string().optional(),
  uuid: z.string().nullish().optional(),
  widget_id: z.string().nullish().optional(),
  description: z.string().nullish().optional(),
  metadata: z.record(z.string(), z.any()).nullish().optional(),
  citable: z.boolean().optional(),
});

const ExtraCitationSchema = z.object({
  id: z.string().optional(),
  source_info: SourceInfoSchema,
  details: z.array(z.any()).optional(),
  artifacts: z.array(z.any()).optional(),
  quote_bounding_boxes: z.array(z.array(z.any())).optional(),
  signature: z.string().optional(),
});

const DataFormatSchema = z.union([
  z.object({
    data_type: z.enum(AI_SUPPORTED_FILE_TYPES),
    filename: z.string().optional(),
  }),
  z.object({
    data_type: z.literal("object").default("object"),
    parse_as: z.enum(ParseAsTypes).optional(),
  }),
]);

const CurrentCopilotDataItemSchema = z.union([
  z.object({
    error_type: z.string(),
    content: z.string(),
  }),
  z.object({
    content: z.preprocess((input) => {
      if (typeof input === "string") return input;

      return input && JSON.stringify(input);
    }, z.string()),
    data_format: DataFormatSchema,
    citable: z.boolean().optional(),
    extra_citations: z.array(ExtraCitationSchema).optional(),
  }),
  z.object({
    url: z.string(),
    data_format: DataFormatSchema,
    expiration: z.number().int().optional(), // Unix timestamp
  }),
]);

const InvalidDataItemError = {
  error_type: CopilotErrorType.UNEXPECTED,
  content: "Invalid data item format.",
};

export const CopilotDataItemSchema = z.preprocess(
  (data: z.output<typeof CurrentCopilotDataItemSchema>, ctx) => {
    if (typeof data !== "object" || data === null) {
      ctx.addIssue({
        code: "custom",
        message: "Data item cannot be null or undefined.",
        path: ["object"],
      });
      return InvalidDataItemError;
    }

    // Handle backward compatibility for file_reference
    if ("file_reference" in data && !("url" in data)) {
      return {
        ...data,
        url: (data as any).file_reference,
      };
    }
    return data;
  },
  CurrentCopilotDataItemSchema.transform(
    (data) => data as DataContent | DataUrl | CopilotError,
  ),
);
export const MultipleCopilotDataItemSchema = z.array(CopilotDataItemSchema);

export const CopilotDataSchema = z.object({
  items: z.array(CopilotDataItemSchema).transform((items) => {
    // remove extra_citations from items
    return items.map((item) => {
      if ("extra_citations" in item) {
        const { extra_citations, ...rest } = item;
        return rest;
      }
      return item;
    });
  }),
  extra_citations: z.array(ExtraCitationSchema).optional(),
});

export const CopilotCommandResultSchema = z.looseObject({
  status: z.enum(["success", "error"]),
  message: z.string().optional(),
});

export type CopilotDataItemT = z.infer<typeof CopilotDataItemSchema>;
export type CopilotDataT = z.infer<typeof CopilotDataSchema>;
export type CopilotAiDataT = Partial<DataContent & DataUrl & CopilotError>;
export type CopilotCommandResultT = z.infer<typeof CopilotCommandResultSchema>;

export type CopilotFile = {
  name: string;
  description: string;
  status: "pending" | "uploaded" | "failed";
  stored_file_uuid?: string;
  url?: string;
};

export interface CopilotContextItem {
  uuid: string;
  name: string;
  description: string;
  metadata?: Record<string, unknown>;
  data?: CopilotDataT;
}

interface WidgetParam {
  name: string;
  type: "date" | "text" | "ticker" | "number" | "boolean" | "endpoint";
  description: string;
  default_value: string | number | boolean | string[];
  current_value: string | number | boolean | string[];
  executed_value?: string | number | boolean | string[] | null;
  options?: string[];
  get_options?: boolean;
  options_params?: Record<string, string>[];
  multi_select?: boolean;
  split_param_on_citation?: boolean;
  language?: string;
}

export interface CopilotWidget {
  origin?: string;
  widget_id?: string;
  uuid?: string;
  name: string;
  description: string;
  source?: string;
  category?: string;
  sub_category?: string;
  columns?: string[];
  params: WidgetParam[];
  metadata: Record<string, unknown> & {
    tabWidgets?: CopilotWidget[];
    innerTabId?: string;
    widgetCount?: number;
  };
}

// Copilot widgets are ranked by priority
export interface CopilotWidgets {
  primary: CopilotWidget[]; // Widgets that were explicitly added to context by the user by clicking on the AI button or using @ mentions
  secondary: CopilotWidget[]; // Widgets that are in the dashboard but were not explicitly added to context
  extra: CopilotWidget[]; // Every widget that is available to be added to the dashboard
}

export interface Mention {
  id: string;
  group: "dashboard" | "all" | "web" | "sec" | "tab";
  trigger: string;
  name: string;
  description: string;
  content?: CopilotWidget;
}

export interface HierarchicalMention extends Mention {
  _isChildWidget?: boolean;
  _parentTabId?: string;
}

export type ExternalCopilotHolder = {
  status?: "success" | "error";
  enabled?: boolean;
  uuid: string;
  url: string;
  headers: Record<string, string>;
  copilots?: Copilot[];
};

type BaseArtifact = {
  uuid: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
};
type TextArtifact = BaseArtifact & { type: "text"; content: string };
type HtmlArtifact = BaseArtifact & { type: "html"; content: string };
type TableArtifact = BaseArtifact & { type: "table"; content: Record<string, any>[] };
export type ChartArtifactT = BaseArtifact & {
  type: "chart";
  content: Record<string, any>[];
  chart_params: {
    chartType: ChartType;
    xKey: string;
    yKey: string[];
    angleKey?: string;
    calloutLabelKey?: string;
    labelKey?: string;
    labelName?: string;
  };
};

export type SnowflakeArtifactT = BaseArtifact & {
  type: "snowflake_query" | "snowflake_python";
  content: string;
  query_data_source: {
    origin: string;
    id: string;
    widget_uuid: string;
  };
};

/** Per-widget grid placement inside an app artifact tab. `i` MUST equal `widget_id`. */
type AppArtifactLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  state?: Record<string, unknown>;
  groups?: string[];
};

/** Parameter-sync group; ticker groups omit `paramName`, `defaultValue` is a symbol. */
type AppArtifactGroup = {
  name: string;
  type: "param" | "endpointParam" | "ticker";
  paramName?: string;
  defaultValue: string;
  widgetIds: string[];
};

/** apps.json template shape consumed by `createCustomTemplateTab`. */
export type AppArtifactDef = {
  name: string;
  description?: string;
  allowCustomization?: boolean;
  tabs: Record<string, { id: string; name: string; layout: AppArtifactLayoutItem[] }>;
  groups?: AppArtifactGroup[];
  prompts?: string[];
};

/** Origin -> Source resolution hint for each widget the app references. */
export type AppArtifactWidgetRef = {
  i: string;
  origin: string;
  widget_id: string;
  uuid?: string;
  name?: string;
};

export type AppArtifactT = BaseArtifact & {
  type: "app";
  app: AppArtifactDef;
  widget_refs: AppArtifactWidgetRef[];
};

export type ArtifactT =
  | TextArtifact
  | HtmlArtifact
  | TableArtifact
  | ChartArtifactT
  | SnowflakeArtifactT
  | AppArtifactT;

export type ArtifactType<T extends ArtifactT["type"]> =
  T extends SnowflakeArtifactT["type"]
    ? SnowflakeArtifactT
    : Extract<ArtifactT, { type: T }>;

export type DetailT = Record<string, any> | null;

export interface DatetimeState {
  timestamp: number;
  targetGroupId: string;
}

export interface SystemSSEContent {
  eventType: "INFO" | "WARNING" | "ERROR";
  message: string;
  hidden?: boolean;
  details?: string[] | DetailT[] | null;
  artifacts?: ArtifactT[] | null;
}

type SourceInfo = z.infer<typeof SourceInfoSchema>;
export interface QuoteBoundingBox {
  page: number;
  text: string;
  top: number;
  bottom: number;
  x0: number;
  x1: number;
}
export interface Citation {
  id: string;
  source_info: SourceInfo;
  details?: DetailT[] | null;
  artifacts?: ArtifactT[];
  signature: string;
  quote_bounding_boxes?: QuoteBoundingBox[][];
}

export interface MessageGroup {
  role: "human" | "ai" | "system" | "tool";
  groupTitle: string;
  parentGroupId?: string;
  messages: Message[];
  senderId: string;
  isError?: boolean;
}

interface BaseMessage {
  copilotId: string;
  uuid?: string;
  timestamp: number;
  isError?: boolean;
  isFC?: boolean;
  isHidden?: boolean;
  usedPersonalOpenAiKey?: boolean;
}

export interface HumanMessage extends BaseMessage {
  role: "human";
  content: string;
  /** Files attached in the composer when this message was sent. */
  files?: CopilotFile[];
}

export interface AIMessage extends BaseMessage {
  role: "ai";
  content: string;
  citations?: Citation[];
  completionId?: string;
  showCitations?: boolean;
  voteStatus?: "thumbs_up" | "thumbs_down" | null;
  traceId?: string;
  isCancelled?: boolean;
  suggestions?: string[];
}

export interface SystemMessage extends BaseMessage {
  role: "system";
  content: SystemSSEContent;
  // Snapshot of the orchestration toggle at the time this message was streamed.
  // Keeps the reasoning group title stable when the toggle is flipped later.
  orchestrationModeEnabled?: boolean;
}

export interface ToolMessageBase extends BaseMessage {
  role: "tool";
  data: CopilotDataT[] | CopilotCommandResultT[];
}

export type ToolMessage = ToolMessageBase & FunctionCallSchemaT;

export type Message = HumanMessage | AIMessage | SystemMessage | ToolMessage;

export type Chat<M = Message> = {
  uuid: string;
  createdAt: number;
  label: string;
  messages: M[];
  artifacts?: ArtifactT[];
  titleManuallyUpdated?: boolean;
  titleNeedsUpdate?: boolean;
  lastOpened?: number;
  lastInteraction?: number;
  agentIds?: string[]; // List of agents that participated in the chat
};

export type CopilotTextSuggestion = {
  question: string;
  matchCount: number;
  idsLength: number;
};

export interface MetadataFormValues {
  name: string;
  description?: string;
  category?: string;
  subCategory?: string;
  source?: string;
}

export interface CreateWidgetMetadataDialogState {
  mode: "create" | "update";
  initialValues: MetadataFormValues;
  // For create mode - stores the pending widget params
  pendingParams?: Record<string, unknown>;
  // For update mode - stores widget identifiers
  widgetId?: string;
  widgetUuid?: string;
  dashboardId?: string;
}

export interface CopilotState {
  /**  Suggestions for user prompts. */
  copilotTextSuggestions: CopilotTextSuggestion[];
  setCopilotTextSuggestions: (suggestions: CopilotTextSuggestion[]) => void;
  /** Action history for workspace context. */
  actionHistory: string[];
  addAction: (action: string) => void;
  clearActionHistory: () => void;
  /** Artifacts are pieces of data (e.g., tables, charts) generated by the AI
  that can be displayed in the chat. */
  addArtifactToCurrentChat: (artifact: ArtifactT) => void;
  getCurrentChatArtifact: (chatArtifactId: string) => ArtifactT | undefined;
  getCurrentChatArtifacts: () => ArtifactT[];
  /** Retrieves a message by its timestamp. */
  getMessageByTimestamp: (timestamp: number) => HumanMessage | AIMessage | undefined;
  /** Clears all messages after a specific timestamp and updates the last human message.*/
  clearMessagesAfter: (messageTimestamp: number, newMessageContent: string) => void;
  /** Removes artifacts that are no longer referenced in any message.*/
  removeUnreachableArtifacts: () => void;
  /** Updates the label of a specific chat.*/
  updateCopilotLabel: (chatId: number, label: string) => void;
  /** History of questions asked by the user.*/
  questionsHistory: string[];
  /** The currently selected copilot instance.*/
  selectedCopilot: Copilot | null;
  setSelectedCopilot: (copilot: Copilot | null) => void;
  orchestrationModeEnabled: boolean;
  setOrchestrationModeEnabled: (enabled: boolean) => void;
  /** Opens the agent configuration dialog.*/
  agentOrchestrationMap: Record<string, string[]>;
  clearAgentOrchestrationMap: () => void;
  toggleAgentOrchestration: (holderId: string, copilotId: string) => void;
  enableAgentOrchestration: (holderId: string, copilotId: string) => void;
  disableAgentOrchestration: (holderId: string, copilotId: string) => void;
  /** Sets the selected copilot by its ID.*/
  setCopilotById: (copilotId: string) => void;
  /** Holds information about external copilots.*/
  externalCopilotHolders: ExternalCopilotHolder[];
  setExternalCopilotHolders: (holders: ExternalCopilotHolder[]) => void;
  updateExternalCopilotHolders: (holders: ExternalCopilotHolder[]) => void;
  /** The timestamp of the currently active chat.*/
  currentChat: number;
  setCurrentChat: (chatId: number) => void;
  loadChatData: (chatUuid: string) => Promise<void>;
  /** Retrieves the current chat object.*/
  getCurrentChat: () => Chat;
  /** Holds all chat sessions.*/
  chats: Chat[];
  /** A copy of chats as stored in the cloud, used for comparison.*/
  chatsStoredInCloud: Chat[] | null;
  updateChatsStoredInCloud: (chats: Chat[]) => void;
  /** Retrieves chat data without messages for the current copilot.*/
  getChatsData: () => Omit<Chat, "messages" | "artifacts">[];
  /** Updates the chats, including merging and migrations.*/
  updateChats: (
    chats: Chat[],
    options?: { customCopilots?: CustomCopilot[]; questionsHistory?: string[] },
  ) => void;
  /** Resets all chats to the default state.*/
  resetChats: () => void;
  /** Adds a new chat to the list.*/
  addChat: (chat: Chat) => void;
  /** Removes a chat by its ID.*/
  removeChat: (chatId: number) => void;
  /** Adds a message to the current chat.*/
  addMessage: (message: Message) => void;
  /** Removes messages from the current chat by their timestamps.*/
  removeMessages: (timestamps: number[]) => void;
  /** Resets the content of the current chat, optionally for a specific copilot.*/
  resetContent: (copilotId?: string) => void;
  selectedModelByAgent: Record<string, string>;
  setSelectedModelForAgent: (agentId: string, modelId: string) => void;
  getSelectedModelForAgent: (agentId: string) => string | undefined;
  /** Updates the last message in the current chat, typically an AI message.*/
  updateLastMessage: (update: Partial<AIMessage>) => void;
  /** Updates a specific property of an AI message.*/
  updateAIMessage: (property: string, value: any, messageTimestamp: number) => void;
  /** Sets the error state of the last message.*/
  updateLastMessageError: (isError?: boolean) => void;
  /** Marks the last message as a function call.*/
  makeLastMessageFC: () => void;
  /** State of the typing indicator.*/
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;
  toggleTyping: () => void;
  /** Manages the state of the chat title, whether it has been manually updated.*/
  setTitleManuallyUpdated: (chatId: number, titleManuallyUpdated: boolean) => void;
  setTitleNeedsUpdate: (chatId: number, titleNeedsUpdate: boolean) => void;
  updateCopilotLabelAndSetTitleNeedsUpdate: (
    label: string,
    titleNeedsUpdate: boolean,
  ) => void;
  /** Retrieves the user prompt that triggered a specific AI message.*/
  getUserPromptForAIMessage: (aiMessage: AIMessage) => string | undefined;
  /** Gets recent conversation context for widget creation.*/
  getRecentConversationContext: (messageCount?: number) => Message[];
  /** Gets metadata from selected widgets in context.*/
  getSelectedWidgetsMetadata: () => CopilotWidget[];
  /** Gets related artifacts from current chat.*/
  getRelatedArtifacts: (maxCount?: number) => ArtifactT[];
  /** ID of the widget being hovered over in a citation.*/
  hoveredCitationWidgetId: string | null;
  setHoveredCitationWidgetId: (id: string | null) => void;
  updateCitationsOrigin: (previousOrigin: string, newOrigin: string) => void;
  hoveredTabId: string | null;
  setHoveredTabId: (id: string | null) => void;
  setHovered: (params?: { widgetUuid?: string | null; tabId?: string | null }) => void;
  /** Controls the visibility of the welcome screen.*/
  showWelcome: boolean;
  setShowWelcome: (showWelcome: boolean) => void;
  /** Controls the fullscreen mode of the copilot panel.*/
  isFullscreen: boolean;
  setIsFullscreen: (isFullscreen: boolean) => void;
  toggleFullscreen: () => void;
  /** Stores the last state of the panel (open or fullscreen).*/
  lastPanelState: "open" | "fullscreen";
  setLastPanelState: (state: "open" | "fullscreen") => void;
  /** Indicates if an action was triggered by a button click.*/
  isButtonTriggered: boolean;
  setIsButtonTriggered: (isButtonTriggered: boolean) => void;
  /** Indicates if the copilot panel was intentionally collapsed by the user.*/
  isIntentionallyCollapsed: boolean;
  setIsIntentionallyCollapsed: (isIntentionallyCollapsed: boolean) => void;
  /** DateTime tooltip positioning state */
  datetimeState: DatetimeState | null;
  showDatetime: (timestamp: number, targetGroupId: string) => void;
  hideDatetime: () => void;

  customFeatureStates: Record<string, boolean | string>;
  initializeCustomFeatures: (features: Copilot["features"]) => void;
  toggleCustomFeature: (key: string) => boolean;
  setCustomFeatureValue: (key: string, value: string) => void;

  /** Dialog state for editing widget metadata from artifact creation */
  createWidgetMetadataDialog: CreateWidgetMetadataDialogState | null;
  setCreateWidgetMetadataDialog: (
    state: CreateWidgetMetadataDialogState | null,
  ) => void;
  closeCreateWidgetMetadataDialog: () => void;
}

const aiCopilotOpenBBCopilotFF = getConfig().copilot.openbbCopilot;

const currentDate = Date.now();
const DEFAULT_CHAT = {
  uuid: uuidv4(),
  createdAt: currentDate,
  label: "New chat",
  messages: [],
  titleManuallyUpdated: false,
  titleNeedsUpdate: true,
  lastOpened: currentDate,
  agentIds: ["openbb-copilot"],
} as Chat;

function getChatLastOpened(chats: Chat[], currentChat?: number | null) {
  const maxLastOpened = Math.max(...chats.map((c) => c.lastOpened || 0));
  return (
    chats.find((c) => c.createdAt === currentChat || c.lastOpened === maxLastOpened) ||
    chats[chats.length - 1]
  );
}

function normalizeExternalCopilotHolder(
  holder: ExternalCopilotHolder,
  fallbackEnabled = true,
): ExternalCopilotHolder {
  return {
    ...holder,
    enabled: holder.enabled ?? fallbackEnabled,
  };
}

function removeChatScrollY(chatId: number) {
  try {
    const copilotScroll = JSON.parse(localStorage.getItem("copilotScrollY") || "{}");
    delete copilotScroll[chatId];
    localStorage.setItem("copilotScrollY", JSON.stringify(copilotScroll));
  } catch (_) {}
}

export function getReachableArtifacts(
  messages: Message[],
  artifacts: ArtifactT[],
): ArtifactT[] {
  const aiMessages = messages?.filter((message) => message.role === "ai") ?? [];
  if (!artifacts?.length) return artifacts ?? [];

  const reachableArtifacts = artifacts?.filter((artifact) => {
    return aiMessages.some(
      (message) =>
        message.content?.includes(artifact?.uuid) ||
        (artifact?.name ? message.content?.includes(artifact?.name) : false),
    );
  });

  return reachableArtifacts ?? [];
}

function updateAgentIds(chat: Chat, selectedCopilot: Copilot | null, reset = false) {
  if (reset) {
    chat.agentIds = [selectedCopilot?.id || "openbb-copilot"];
    return chat;
  }
  if (!(chat && selectedCopilot?.id)) return chat;
  chat.agentIds = chat.agentIds || [];
  if (!chat.agentIds.includes(selectedCopilot?.id))
    chat.agentIds.push(selectedCopilot.id);

  return chat;
}

export const useCopilotStore = createWithEqualityFn<CopilotState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        updateCitationsOrigin: (previousOrigin: string, newOrigin: string) => {
          const { chats } = get();

          const updatedChats = chats.map((chat) => {
            const updatedMessages = chat.messages.map((message) => {
              if (!(message.role === "ai" && Array.isArray(message.citations)))
                return message;

              const updatedCitations = message.citations.map((citation) => {
                const sourceInfo = citation.source_info;
                if (sourceInfo?.origin !== previousOrigin) return citation;

                const widget_id = sourceInfo?.widget_id?.replace(
                  previousOrigin,
                  newOrigin,
                );
                return {
                  ...citation,
                  source_info: {
                    ...citation.source_info,
                    origin: newOrigin,
                    widget_id,
                  },
                };
              });
              return { ...message, citations: updatedCitations };
            });

            return { ...chat, messages: updatedMessages };
          });

          set({ chats: updatedChats });
        },
        copilotTextSuggestions: [],
        setCopilotTextSuggestions: (suggestions) =>
          set({ copilotTextSuggestions: suggestions }),
        actionHistory: [],
        addAction: (action) =>
          set((state) => ({
            actionHistory: [...state.actionHistory.slice(-4), action], // Keep last 5 actions
          })),
        clearActionHistory: () => set({ actionHistory: [] }),
        getCurrentChatArtifacts: () => {
          const { currentChat, chats } = get();
          const currentChatData = chats.find((c) => c.createdAt === currentChat);
          return currentChatData?.artifacts || [];
        },
        getCurrentChatArtifact: (chatArtifactId: string) => {
          const { currentChat, chats } = get();
          const currentChatData = chats.find((c) => c.createdAt === currentChat);
          return currentChatData?.artifacts?.find(
            // We need to check for UUID for backward compatibility
            (a) => a.name === chatArtifactId || a.uuid === chatArtifactId,
          );
        },
        addArtifactToCurrentChat: (artifact) => {
          const { currentChat, chats } = get();
          const currentChatData = chats.find((c) => c.createdAt === currentChat);
          artifact.timestamp = artifact.timestamp || Date.now();
          if (currentChatData) {
            currentChatData.artifacts = [
              ...(currentChatData.artifacts || []),
              artifact,
            ];
          }
        },
        updateChats: (chats, options = {}) => {
          if (!chats) return;

          const { customCopilots, questionsHistory = get().questionsHistory } = options;

          if (customCopilots) {
            getExternalCopilotHolders(customCopilots, (externalCopilotHolders) =>
              get().setExternalCopilotHolders(externalCopilotHolders),
            );
          }

          const chatsCreatedAt = {} as Record<number, Chat[]>;

          for (const chat of chats) {
            // Ensure createdAt is in milliseconds
            if (chat?.createdAt < 10000000000) {
              chat.createdAt *= 1000;
            }

            const artifactMapping = (chat.artifacts || []).reduce(
              (acc, a) => {
                acc[a.name] = a;
                acc[a.uuid] = a;

                return acc;
              },
              {} as Record<string, ArtifactT>,
            );

            const agentIds = chat?.agentIds || [];
            let lastInteraction = chat?.lastInteraction || 0;
            // Extract questions from human messages for history
            for (const message of chat?.messages || []) {
              if (!message.uuid) message.uuid = uuidv4();
              if (!agentIds.includes(message.copilotId))
                agentIds.push(message.copilotId);

              // Backward compatibility for AI messages
              if (message.role === "ai") {
                try {
                  const content = migrateFuncCallArgs(JSON.parse(message.content));
                  message.content = JSON.stringify(content);
                } catch (e) {
                  // Ignore errors
                }

                // Backward compatibility for citations
                if (typeof message.content === "string") {
                  for (const citation of message.citations || []) {
                    citation.id = citation.id || uuidv4();
                    const sourceInfo = citation.source_info;
                    const marker = `<citation className="${citation.id}"/>`;

                    if (
                      sourceInfo?.type === "artifact" &&
                      !artifactMapping?.[sourceInfo?.name]
                    ) {
                      message.content = message.content.replace(marker, "");
                    } else if (!message.content.includes(marker)) {
                      message.content += marker;
                    }
                  }
                }
              }

              // Backward compatibility for tool messages
              if (message?.role === "tool") {
                // @ts-expect-error
                const old_content = message?.content;
                if (old_content) {
                  // @ts-expect-error
                  message.data = [{ content: old_content }];
                  // @ts-expect-error
                  message.content = undefined;
                }

                if (!Array.isArray(message.data)) {
                  message.data = [{ items: [message.data] }];
                }

                // We ignore because the old schema is not declared
                message.data = message.data.map((element) => {
                  if (Array.isArray(element.items)) return element;
                  return { items: [element] };
                });

                migrateFuncCallArgs(message);
              }

              lastInteraction = Math.max(lastInteraction || 0, message.timestamp);
            }

            chat.agentIds = agentIds;
            chat.lastInteraction = lastInteraction;
            const chatGroup = chatsCreatedAt[chat.createdAt];
            if (!chatGroup) {
              chatsCreatedAt[chat.createdAt] = [chat];
              continue;
            }

            // Merge duplicate chats
            chatsCreatedAt[chat.createdAt] = mergeDuplicateChats([...chatGroup, chat]);
          }

          // Update the chats with merged duplicates
          const updatedChats = Object.values(chatsCreatedAt).flat();
          // sort chats by createdAt
          updatedChats.sort((a, b) => a.createdAt - b.createdAt);

          if (updatedChats.length > 0) {
            const latestChat = getChatLastOpened(updatedChats);
            set({
              chats: updatedChats,
              currentChat: latestChat.createdAt,
              chatsStoredInCloud: chats,
              questionsHistory,
            });
          }
        },
        resetChats: () =>
          set({ chats: [DEFAULT_CHAT], currentChat: DEFAULT_CHAT.createdAt }),
        getMessageByTimestamp: (timestamp: number) => {
          const { currentChat, chats } = get();
          const currentChatData = chats.find((c) => c.createdAt === currentChat);
          if (currentChatData) {
            return currentChatData.messages.find(
              (message) => message.timestamp === timestamp,
            ) as AIMessage | HumanMessage;
          }
          return undefined;
        },
        clearMessagesAfter: (messageTimestamp: number, newMessageContent: string) => {
          const { currentChat, chats, selectedCopilot } = get();
          const currentChatData = chats.find((c) => c.createdAt === currentChat);
          if (currentChatData) {
            const updatedMessages = currentChatData.messages.filter(
              (message) => message.timestamp <= messageTimestamp,
            );

            const lastMessage = updatedMessages.findLast(
              (message) => message.role === "human",
            ) as HumanMessage;
            lastMessage.content = newMessageContent;
            lastMessage.timestamp = Date.now();
            lastMessage.isError = false;

            const agentIds = Array.from(
              new Set<string>(updatedMessages.map((m) => m.copilotId)),
            );

            set({
              chats: get().chats.map((c) =>
                c.createdAt === currentChat
                  ? { ...c, messages: updatedMessages, agentIds }
                  : c,
              ),
            });
          }
        },
        removeUnreachableArtifacts: () => {
          const { currentChat, chats } = get();
          const currentChatData = chats.find((c) => c.createdAt === currentChat);
          if (currentChatData) {
            const reachableArtifacts = getReachableArtifacts(
              currentChatData.messages,
              currentChatData.artifacts || [],
            );

            set({
              chats: get().chats.map((c) =>
                c.createdAt === currentChat
                  ? { ...c, artifacts: reachableArtifacts }
                  : c,
              ),
            });
          }
        },
        updateCopilotLabel: (chatId, label) => {
          set({
            chats: get().chats.map((c) =>
              c.createdAt === chatId ? { ...c, label } : c,
            ),
          });
        },
        getCurrentChat: () => {
          const { chats, currentChat } = get();

          // If no currentChat, return the latest chat
          return getChatLastOpened(chats, currentChat) || DEFAULT_CHAT;
        },
        questionsHistory: [],
        isTyping: false,
        setIsTyping: (typing) => set({ isTyping: typing }),
        toggleTyping: () => set((state) => ({ isTyping: !state.isTyping })),
        selectedModelByAgent: {},
        currentChat: 0,
        setCurrentChat: (chatId) => {
          // Clear action history when switching to a different chat
          if (chatId !== get().currentChat) {
            get().clearActionHistory();
          }

          if (chatId === 0) {
            const latestChat = getChatLastOpened(get().chats, chatId);
            return get().loadChatData(latestChat?.uuid);
          }
          set({
            currentChat: chatId,
            chats: get().chats.map((c) =>
              c.createdAt === chatId ? { ...c, lastOpened: Date.now() } : c,
            ),
          });
        },
        loadChatData: async (chatUuid) => {
          const { chats } = get();
          const chatIndex = chats.findIndex((c) => c.uuid === chatUuid);
          if (chatIndex !== -1) {
            const updatedChats = [...chats];
            if (!updatedChats[chatIndex]?.messages) {
              const chat = await getCopilotChat(chatUuid);
              if (chat) {
                updatedChats[chatIndex] = chat;
                return get().updateChats(updatedChats);
              }
            }
            get().setCurrentChat(chats[chatIndex]?.createdAt || 0);
          }
        },
        chats: [],
        chatsStoredInCloud: null,
        updateChatsStoredInCloud: (chats) => set({ chatsStoredInCloud: chats }),
        addChat: (chat) => {
          // Clear action history when creating a new chat
          get().clearActionHistory();
          set({ chats: [...get().chats, updateAgentIds(chat, get().selectedCopilot)] });
        },
        removeChat: (chatId) => {
          removeChatScrollY(chatId);
          set({ chats: get().chats.filter((c) => c.createdAt !== chatId) });
        },
        makeLastMessageFC: () => {
          const { currentChat, chats } = get();
          const messages =
            chats.find((c) => c.createdAt === currentChat)?.messages || [];
          if (messages.length > 0) {
            const updatedMessages = [...messages];
            updatedMessages[updatedMessages.length - 1].isFC = true;
            set({
              chats: chats.map((c) =>
                c.createdAt === currentChat ? { ...c, messages: updatedMessages } : c,
              ),
            });
          }
        },
        updateLastMessage: (update) => {
          const { currentChat, chats } = get();
          const messages =
            chats.find((c) => c.createdAt === currentChat)?.messages || [];
          if (messages.length > 0) {
            // Copy the messages array to avoid direct state mutation
            const updatedMessages = cloneDeep(messages);
            const lastMessage = updatedMessages[updatedMessages.length - 1];
            // Safeguard to update only the last message if it's an AI message
            if (lastMessage.role === "ai") {
              // Update the last message with the new data
              Object.assign(lastMessage, update || {});

              // Set the updated messages array in the state
              set({
                chats: chats.map((c) =>
                  c.createdAt === currentChat ? { ...c, messages: updatedMessages } : c,
                ),
              });
            }
          }
        },
        updateAIMessage: (property, value, messageTimestamp) => {
          const { currentChat, chats } = get();
          const messages =
            chats.find((c) => c.createdAt === currentChat)?.messages || [];
          if (messages.length > 0) {
            const updatedMessages = cloneDeep(messages);
            const message = updatedMessages.find(
              (m) => m.timestamp === messageTimestamp,
            );
            if (message && message.role === "ai") {
              message[property] = value;
              set({
                chats: chats.map((c) =>
                  c.createdAt === currentChat ? { ...c, messages: updatedMessages } : c,
                ),
              });
            }
          }
        },
        updateLastMessageError: (isError) => {
          const { currentChat, chats } = get();
          const messages =
            chats.find((c) => c.createdAt === currentChat)?.messages || [];
          if (messages.length > 0) {
            const updatedMessages = cloneDeep(messages);
            updatedMessages[updatedMessages.length - 1].isError = isError;
            set({
              chats: chats.map((c) =>
                c.createdAt === currentChat ? { ...c, messages: updatedMessages } : c,
              ),
            });
          }
        },
        setSelectedModelForAgent: (agentId, modelId) =>
          set((state) => ({
            selectedModelByAgent: { ...state.selectedModelByAgent, [agentId]: modelId },
          })),
        getSelectedModelForAgent: (agentId) => get().selectedModelByAgent[agentId],
        selectedCopilot: aiCopilotOpenBBCopilotFF ? getDefaultCopilot() : null,
        setSelectedCopilot: (copilot) => {
          // This is a temporary check to notify users about outdated copilots.json
          // We need to implement copilots.json versioning to handle this properly.
          const outdatedFlags = [
            copilot.hasDocuments !== undefined && "hasDocuments",
            copilot.hasFunctionCalling !== undefined && "hasFunctionCalling",
            copilot.hasStreaming !== undefined && "hasStreaming",
          ].filter(Boolean);
          if (copilot.id !== "openbb-copilot" && outdatedFlags.length > 0) {
            showDeprecatedFlagsToast(copilot, outdatedFlags);
          }

          set({ selectedCopilot: copilot });
        },
        orchestrationModeEnabled: false,
        setOrchestrationModeEnabled: (enabled) =>
          set({ orchestrationModeEnabled: enabled }),
        agentOrchestrationMap: {},
        clearAgentOrchestrationMap: () => set({ agentOrchestrationMap: {} }),
        enableAgentOrchestration: (holderId, agentId) => {
          const { agentOrchestrationMap } = get();
          if (agentOrchestrationMap[holderId]?.includes(agentId)) return;
          set({
            agentOrchestrationMap: {
              ...agentOrchestrationMap,
              [holderId]: [...(agentOrchestrationMap[holderId] || []), agentId],
            },
          });
        },
        disableAgentOrchestration: (holderId, agentId) => {
          const { agentOrchestrationMap } = get();
          if (!agentOrchestrationMap[holderId]?.includes(agentId)) return;
          const newEnabledIds = (agentOrchestrationMap[holderId] || []).filter(
            (id) => id !== agentId,
          );
          set({
            agentOrchestrationMap: {
              ...agentOrchestrationMap,
              [holderId]: newEnabledIds,
            },
          });
        },
        toggleAgentOrchestration: (holderId, agentId) => {
          const { agentOrchestrationMap } = get();
          if (agentOrchestrationMap[holderId]?.includes(agentId)) {
            get().disableAgentOrchestration(holderId, agentId);
          } else {
            get().enableAgentOrchestration(holderId, agentId);
          }
        },
        setCopilotById: (copilotId) => {
          const { externalCopilotHolders, setSelectedCopilot } = get();
          if (copilotId === "openbb-copilot")
            return setSelectedCopilot(getDefaultCopilot());

          const copilot = externalCopilotHolders
            .filter((holder) => holder.enabled !== false)
            .flatMap((holder) => holder.copilots || [])
            .find((c) => c.id === copilotId || c.name === copilotId);

          if (copilot) return setSelectedCopilot(copilot);

          console.warn(`Copilot with ID "${copilotId}" not found.`);
        },
        externalCopilotHolders: [],
        setExternalCopilotHolders: (holders) => {
          const currentHolders = get().externalCopilotHolders;
          const normalizedHolders = holders.map((holder) => {
            const existingHolder = currentHolders.find((h) => h.uuid === holder.uuid);
            return normalizeExternalCopilotHolder(
              holder,
              existingHolder?.enabled ?? true,
            );
          });
          const uniqueCopilots = normalizedHolders.filter(
            (copilot, index) =>
              normalizedHolders.findIndex((c) => c.url === copilot.url) === index,
          );

          // Auto-select an agent when none is currently selected (or the current
          // selection is gone). Without this, agents arriving from the backend or
          // persist rehydrate (e.g. lite, where openbbCopilot is off and
          // selectedCopilot starts null) leave the panel stuck on "No copilot
          // selected" until the user re-adds the agent. The built-in OpenBB copilot
          // and any still-valid selection are preserved.
          const selectedCopilot = get().selectedCopilot;
          const availableCopilots = uniqueCopilots
            .filter((holder) => holder.enabled !== false)
            .flatMap((holder) => holder.copilots || []);
          const selectionStillValid =
            selectedCopilot?.id === "openbb-copilot" ||
            availableCopilots.some((c) => c.id === selectedCopilot?.id);
          const nextSelectedCopilot = selectionStillValid
            ? selectedCopilot
            : (availableCopilots[0] ?? null);

          set({
            externalCopilotHolders: uniqueCopilots,
            selectedCopilot: nextSelectedCopilot,
          });
        },
        updateExternalCopilotHolders: (holders) => {
          if (!holders || holders?.length === 0) return;
          const externalCopilotHolders = cloneDeep(get().externalCopilotHolders);
          const selectedCopilot = get().selectedCopilot;

          const updatedHolders = holders.reduce((acc, holderToMerge) => {
            const existingHolder = acc.find((h) => h.uuid === holderToMerge.uuid);
            const holder = normalizeExternalCopilotHolder(
              holderToMerge,
              existingHolder?.enabled ?? true,
            );
            holder.copilots = holder.copilots || existingHolder?.copilots || [];

            if (existingHolder) {
              const selectedUpdate = holder.copilots.find(
                (copilot) => copilot.id === selectedCopilot?.id,
              );
              // If the selected copilot is in the holder, update it
              if (selectedUpdate) Object.assign(selectedCopilot, selectedUpdate);

              Object.assign(existingHolder, holder);
              return acc;
            }

            acc.push(holder);

            return acc;
          }, externalCopilotHolders);

          set({ externalCopilotHolders: updatedHolders, selectedCopilot });
        },
        messages: [],
        addMessage: (message) => {
          if (!message.uuid) message.uuid = uuidv4();

          set((s) => {
            const updatedChats = s.chats.map((chat) =>
              chat.createdAt === s.currentChat
                ? {
                    ...updateAgentIds(chat, s.selectedCopilot),
                    messages: [...chat.messages, message],
                    lastInteraction: message.timestamp,
                  }
                : chat,
            );

            const updates: Partial<CopilotState> = {};

            if (message.role === "human") {
              // find the index if the message content is already in the questions history
              const questionIndex = s.questionsHistory.indexOf(message.content);
              if (questionIndex === -1) {
                updates.questionsHistory = [...s.questionsHistory, message.content];
              } else {
                // Move the question to the end of the history
                const updatedHistory = cloneDeep(s.questionsHistory);
                updatedHistory.splice(questionIndex, 1);
                updatedHistory.push(message.content);
                updates.questionsHistory = updatedHistory;
              }
            }

            return {
              chats: updatedChats,
              ...updates,
            };
          });
        },
        removeMessages: (timestamps) => {
          set((state) => ({
            chats: state.chats.map((chat) => {
              if (chat.createdAt !== state.currentChat) return chat;
              const newMessages = chat.messages.filter(
                (message) => !timestamps.includes(message.timestamp),
              );

              // Remove any artifacts that are no longer referenced in any message
              const updatedArtifacts = getReachableArtifacts(
                newMessages,
                chat.artifacts || [],
              );

              return {
                ...chat,
                messages: newMessages,
                artifacts: updatedArtifacts,
              };
            }),
          }));
        },
        resetContent: (copilotId) => {
          removeChatScrollY(get().currentChat);
          // Clear action history when resetting chat content
          get().clearActionHistory();
          if (copilotId) {
            const uuid = uuidv4();

            set((state) => ({
              chats: state.chats.map((chat) => {
                if (chat.createdAt !== state.currentChat) return chat;
                const messages = chat.messages.filter((m) => m.copilotId !== copilotId);
                const artifacts = getReachableArtifacts(messages, chat.artifacts);
                const agentIds = (chat.agentIds || []).filter((id) => id !== copilotId);
                if (agentIds.length === 0) agentIds.push(copilotId || "openbb-copilot");

                return { ...chat, uuid, id: uuid, messages, artifacts, agentIds };
              }),
            }));
          } else {
            set((state) => ({
              chats: state.chats.map((chat) =>
                chat.createdAt === state.currentChat
                  ? {
                      ...updateAgentIds(chat, state.selectedCopilot, true),
                      messages: [],
                    }
                  : chat,
              ),
            }));
          }
        },
        setTitleManuallyUpdated: (chatId, titleManuallyUpdated) => {
          set({
            chats: get().chats.map((c) =>
              c.createdAt === chatId ? { ...c, titleManuallyUpdated } : c,
            ),
          });
        },
        setTitleNeedsUpdate: (chatId, titleNeedsUpdate) => {
          set({
            chats: get().chats.map((c) =>
              c.createdAt === chatId ? { ...c, titleNeedsUpdate } : c,
            ),
          });
        },
        updateCopilotLabelAndSetTitleNeedsUpdate: (label, titleNeedsUpdate) => {
          const { currentChat } = get();
          set({
            chats: get().chats.map((c) =>
              c.createdAt === currentChat ? { ...c, label, titleNeedsUpdate } : c,
            ),
          });
        },
        getUserPromptForAIMessage: (aiMessage: AIMessage) => {
          const currentChat = get().getCurrentChat();
          const messageIndex = currentChat.messages.findIndex(
            (msg) => msg.role === "ai" && msg.timestamp === aiMessage.timestamp,
          );

          if (messageIndex === -1) return undefined;

          // Look for the most recent human message before this AI message
          for (let i = messageIndex - 1; i >= 0; i--) {
            const msg = currentChat.messages[i];
            if (msg.role === "human") {
              return msg.content;
            }
          }

          return undefined;
        },
        getRecentConversationContext: (messageCount = 5) => {
          const currentChat = get().getCurrentChat();
          return currentChat.messages.slice(-messageCount);
        },
        getSelectedWidgetsMetadata: () => {
          const { externalCopilotHolders } = get();
          // This would typically get widgets from copilot data store, but we'll handle this in the component
          // since the copilot store doesn't directly have access to the copilot data store
          return [];
        },
        getRelatedArtifacts: (maxCount = 3) => {
          const { currentChat, chats } = get();
          const currentChatData = chats.find((c) => c.createdAt === currentChat);
          return (currentChatData?.artifacts || []).slice(-maxCount);
        },
        hoveredCitationWidgetId: null,
        setHoveredCitationWidgetId: (id) => set({ hoveredCitationWidgetId: id }),
        hoveredTabId: null,
        setHoveredTabId: (id) => set({ hoveredTabId: id }),
        setHovered: (params) => {
          const { widgetUuid = null, tabId = null } = params || {};
          set({
            hoveredCitationWidgetId: widgetUuid,
            hoveredTabId: tabId,
          });
        },
        showWelcome: false,
        setShowWelcome: (showWelcome) => set({ showWelcome }),
        isFullscreen: false,
        setIsFullscreen: (isFullscreen) => set({ isFullscreen }),
        toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
        isButtonTriggered: false,
        setIsButtonTriggered: (isButtonTriggered: boolean) =>
          set({ isButtonTriggered }),
        isIntentionallyCollapsed: false,
        setIsIntentionallyCollapsed: (isIntentionallyCollapsed: boolean) =>
          set({ isIntentionallyCollapsed }),
        getChatsData: () => {
          return get().chats.map((chat) => {
            const { messages, artifacts, ...rest } = chat;
            return rest;
          });
        },
        lastPanelState: "open",
        setLastPanelState: (lastPanelState: "open" | "fullscreen") =>
          set({ lastPanelState }),
        datetimeState: null,
        showDatetime: (timestamp, targetGroupId) =>
          set({ datetimeState: { timestamp, targetGroupId } }),
        hideDatetime: () => set({ datetimeState: null }),
        customFeatureStates: {},
        initializeCustomFeatures: (features) => {
          if (!features) return;
          set((state) => {
            const current = state.customFeatureStates || {};
            const updated = { ...current } as Record<string, boolean | string>;
            for (const [key, val] of Object.entries(features)) {
              if (val && typeof val === "object") {
                // Only initialize if not already present
                if (updated[key] === undefined) {
                  const featureType = val.type || "toggle";
                  if (featureType === "text") {
                    updated[key] = typeof val.default === "string" ? val.default : "";
                  } else if (featureType === "select") {
                    updated[key] =
                      typeof val.default === "string"
                        ? val.default
                        : (val.options?.[0]?.value ?? "");
                  } else {
                    updated[key] = Boolean(val.default);
                  }
                }
              }
            }
            return { ...state, customFeatureStates: updated };
          });
        },
        toggleCustomFeature: (key) => {
          let newVal = false;
          set((state) => {
            const current = state.customFeatureStates || {};
            const next = !current[key];
            newVal = next;
            return { ...state, customFeatureStates: { ...current, [key]: next } };
          });
          return newVal;
        },
        setCustomFeatureValue: (key, value) => {
          console.log("[custom-features] set", key, value);
          set((state) => {
            const current = state.customFeatureStates || {};
            return { ...state, customFeatureStates: { ...current, [key]: value } };
          });
        },

        createWidgetMetadataDialog: null,
        setCreateWidgetMetadataDialog: (dialogState) =>
          set({ createWidgetMetadataDialog: dialogState }),
        closeCreateWidgetMetadataDialog: () =>
          set({ createWidgetMetadataDialog: null }),
      }),
      {
        name: "copilot",
        partialize: (state) => {
          if (state?.selectedCopilot?.id === "openbb-copilot") {
            state.selectedCopilot = getDefaultCopilot();
          }

          if (inSnowflakeNativeApp) state.agentOrchestrationMap = {};

          return {
            externalCopilotHolders: state.externalCopilotHolders,
            selectedCopilot: state.selectedCopilot,
            lastPanelState: state.lastPanelState,
            isFullscreen: state.isFullscreen,
            isIntentionallyCollapsed: state.isIntentionallyCollapsed,
            isButtonTriggered: state.isButtonTriggered,
            customFeatureStates: state.customFeatureStates,
            selectedModelByAgent: state.selectedModelByAgent,
            agentOrchestrationMap: state.agentOrchestrationMap,
          };
        },
        onRehydrateStorage: () => (state) => {
          if (inSnowflakeNativeApp) {
            state.orchestrationModeEnabled = false;
            state.agentOrchestrationMap = {};
          }
          if (state?.selectedCopilot) {
            const result = copilotSchema.safeParse(state.selectedCopilot);
            if (result.success) {
              state?.setSelectedCopilot(result.data);
            }
          }
          if (
            state?.externalCopilotHolders &&
            state.externalCopilotHolders.length > 0
          ) {
            const validatedHolders = state.externalCopilotHolders.map((holder) => ({
              ...holder,
              copilots: holder.copilots.map((copilot) => {
                const result = copilotSchema.safeParse(copilot);
                return result.success ? result.data : copilot;
              }),
            }));

            for (const [holderId, agentIds] of Object.entries(
              state.agentOrchestrationMap || {},
            )) {
              const holder = validatedHolders.find((h) => h.uuid === holderId);
              if (holder) {
                const validAgentIds = agentIds.filter((id) =>
                  holder.copilots.some((c) => c.id === id),
                );
                state.agentOrchestrationMap[holderId] = validAgentIds;
              } else {
                delete state.agentOrchestrationMap[holderId];
              }
            }
            state?.setExternalCopilotHolders(validatedHolders);
          }
        },
      },
    ),
  ),
  shallow,
);

export function useShallowCopilotStore<S extends CopilotState, T>(
  selector: Selector<S, T>,
): T {
  return useCopilotStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}
