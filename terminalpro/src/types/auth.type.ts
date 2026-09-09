import type { CustomCopilot } from "~/api/auth.api";
import type { WidgetT } from "~/components/types";
import type { Ticker } from "~/lib/state/app";
import type {
  SingleWidget,
  Source,
  StoredFile,
  WidgetMetadataItem,
} from "~/lib/state/backendConnector";
import type { TVState } from "~/lib/state/charting";
import type { Chat } from "~/lib/state/copilot";
import type { FeatureFlags, Usage } from "~/lib/state/featureFlags";
import type { McpServer } from "~/lib/state/mcpTools";
import type { SharedItem } from "~/lib/state/sharedApp";
import type { EntityThemeSettings } from "~/lib/state/tableChartThemes";
import type { UserAppsSync } from "~/lib/state/userApps";

export type DefaultSkillSlugs =
  | "openbb-html-report"
  | "snowflake-html-report"
  | "openbb-html-table"
  | "openbb-html-chart";

export interface DisplaySettings {
  decimalDigits: number;
  theme: "light" | "dark";
  showWidgetControlsEllipsis: boolean;
  aiEnhancements: boolean;
  tablePagination: boolean;
  fontSize: "medium" | "large";
  defaultTicker: Ticker;
  gridCorners: Array<"ne" | "nw" | "se" | "sw">;
  gridSnapping: "off" | "vertical";
  quickAddButtonVisible: boolean;
  showMinimizeButton: boolean;
  showChartGeneration: boolean;
  lastVisitedPage?: string;
  perplexityApiKey?: string;
  openaiApiKey?: string;
  collapsedPanelExpandOnHover?: boolean;
  autoHideWidgetNavbar?: boolean;
  removedSkillSlugs?: DefaultSkillSlugs[]; // Track removed skills by slug to prevent re-adding default skills
}

export type SyncType = "owned" | "shared" | "entity_shared";
export type SharedType = "shared" | "entity_shared";

export interface DashSyncT {
  owned?: Record<string, SharedItem>;
  shared?: Record<string, SharedItem>;
  entity_shared?: Record<string, SharedItem>;
  entity_theme_settings: EntityThemeSettings;
  feature_entitlements?: Omit<FeatureFlags, "is_trial" | "can_submit_marketplace">;
  is_trial_entity?: boolean;
  can_submit_marketplace?: boolean;
  usage?: Usage;
  copilot_chats?: Chat[];
  questions_history?: string[];
  trading_view?: TVState;
  pro_display_settings?: DisplaySettings;
  single_widgets: SingleWidget[];
  file_widgets: StoredFile[];
  widget_metadata: WidgetMetadataItem[];
  user_apps?: UserAppsSync;
  user_skills?: Skill[];
  mcp_servers?: McpServer[];
}

export type DashSync<T extends SyncType = SyncType> = T extends SyncType
  ? DashSyncT[T]
  : never;

export type DashShared = {
  shared: DashSync<"shared">;
  entity_shared: DashSync<"entity_shared">;
};

export type Detail = { status: number; detail: string };
export interface ProLoginResponse {
  is_first_login: boolean;
  custom_copilots: CustomCopilot[];
  feature_entitlements: Omit<FeatureFlags, "is_trial" | "can_submit_marketplace">;
  is_trial_entity: boolean;
  can_submit_marketplace: boolean;
  usage: Usage;
  uuid: string;
  email: string;
  access_token: string;
  microsoftIdToken?: string;
  oktaIdToken?: string;
  username: string;
  expiration_date: string;
  temporary_password: boolean;
  force_2fa: boolean;
  entity_name: null | string;
  entity_theme_settings: EntityThemeSettings;
  role: null | string;
  entitlements: {
    keys_fmp: string;
    keys_polygon: string;
    userMgmt: string;
    proAccess: boolean;
    sharedViews: boolean;
  };
  show_changelog: boolean;
  status?: number;
  detail?: string;
  user: ProUserResponse;
  dash_sync: DashSyncT;
  user_apps: UserAppsSync;
  user_skills: Skill[];
  copilot_chats: Chat[];
  questions_history: string[];
  mcp_servers: McpServer[];
  trading_view: TVState;
  enabled_widget_bundles: EnabledBundles;
  developer_onboarding_info: null | DeveloperOnboardingQuestions;
  moved_to_developer: boolean;
  show_welcome_screen: boolean;
}

export type ProLogin2FAResponse = Detail & { access_token?: string };

export interface EnabledBundles {
  enabled_bundles: string[];
  disabled_widgets: string[];
}

export interface DeveloperOnboardingQuestions {
  primaryUsage: "academic" | "professional" | "personal";
  organization: string | null;
  role: string | null;
  programmingExperience: "no-experience" | "basic" | "intermediate-advanced";
  dataTypes: string[];
  otherDataType: string | null;
  organizationName: string | null;
  skipOnboarding: boolean;
}

export interface SuccessReturn {
  success: boolean;
  message?: string;
}

type RWN = "Read" | "Write" | "None";

interface ProEntitlements {
  benzinga: RWN;
  polygon: RWN;
  intrinio: RWN;
  fmp: RWN;
  datarade: RWN;
  veraset: RWN;
  alphavantage: RWN;
}

export interface ProInfo {
  assetClasses: string[];
  geographies: string[];
  industrySectors: string[];
  role: null | string;
  organization: null | string;
  organizationName: null | string;
  primaryUsage: null | string;
}

export interface Challenges {
  grouping: string | null;
  table_charting: string | null;
  data_connectors: string | null;
  charting: string | null;
  group_sector_companies: string | null;
}

export type Walkthroughs = {
  analyst_walkthrough: string | null;
};

export interface ProUserResponse {
  expiration_date: string;
  entitlements: null | ProEntitlements;
  features_pro_info: null | ProInfo;
  accepted_pro_tos: boolean;
  first_name: null | string;
  last_name: null | string;
  feedback_like: null | string;
  feedback_improve: null | string;
  feedback_to_pay: null | string;
  pro_display_settings: DisplaySettings;
  pro_zero_to_hero: Challenges;
  api_sources: Source[];
  single_widgets: SingleWidget[];
  file_widgets: StoredFile[];
  user_apps: UserAppsSync;
  data_connector_url: null | string;
  primary_usage: null | string;
  widget_metadata: WidgetMetadataItem[];
}

export function isLoggedIn(response: any): response is ProLoginResponse {
  return (response as ProLoginResponse)?.uuid !== undefined && response?.status === 200;
}

export type MetaDataWidgetType =
  | "iframe"
  | "rss_viewer"
  | "rich_note"
  | "ag_chart"
  | "ag_chart_from_table"
  | "copilot_table"
  | "widget_studio"
  | "html"
  | "youtube";

export type WidgetMetadataResponse = {
  widgetId: string;
  widgetType?: MetaDataWidgetType;
  name: string;
  description?: string;
  source?: string;
  category?: string;
  subCategory?: string;
  storage?: Record<string, any>;
  widgetConfig?: Partial<WidgetT>;
};

export interface EnabledBundles {
  enabled_bundles: string[];
  disabled_widgets: string[];
}

export interface SuccessReturn {
  success: boolean;
  message?: string;
}

export interface HTTPValidationError {
  detail: {
    loc: (string | number)[];
    msg: string;
    type: string;
  }[];
}

export interface Prompt {
  id: string;
  prompt: string;
  widgets?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillCreate {
  slug: string;
  description: string;
  content: string;
}

export interface Skill extends SkillCreate {
  id: string;
  createdDate: string;
  updatedDate: string;
}

/**
 * Lightweight skill entry sent with every query to the AI.
 * Contains only the metadata needed for the model to decide if it needs the full content.
 */
export interface SkillCatalogEntry {
  slug: string;
  description: string;
  updatedAt: string;
}

/**
 * Full skill payload sent when user forces via /slug or model requests via function call.
 */
export interface SkillPayload {
  slug: string;
  description: string;
  contentMarkdown: string;
  source: "forced_slash" | "model_selected";
}
