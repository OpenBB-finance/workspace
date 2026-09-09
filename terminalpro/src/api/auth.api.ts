import type { AxiosError } from "axios";
import { toast } from "sonner";
import { z } from "zod";
import type { SearchableChat } from "~/components/AI/hooks/useChatSearch";
import type { WidgetJsonT, WidgetT } from "~/components/types";
import type { WidgetId } from "~/components/Widgets";
import { resultsToTicker } from "~/components/Widgets/Helpers/AdvancedSelectTicker";
import { convertHeadersToRecord } from "~/lib/api";
import { fetchQuerySymbols } from "~/lib/api/sdkComponents";
import { type Extension, VERSION } from "~/lib/constants";
import type { Ticker } from "~/lib/state/app";
import {
  type SingleWidget,
  type Source,
  type StoredFile,
  useBackendConnectorStore,
  type WidgetMetadata,
  type WidgetMetadataItem,
} from "~/lib/state/backendConnector";
import type { TVState } from "~/lib/state/charting";
import {
  type AIMessage,
  type Chat,
  type Copilot,
  copilotSchema,
  type ExternalCopilotHolder,
  type HumanMessage,
} from "~/lib/state/copilot";
import type { FeatureFlags, Usage } from "~/lib/state/featureFlags";
import type { McpServer } from "~/lib/state/mcpTools";
import type { EntityThemeSettings } from "~/lib/state/tableChartThemes";
import {
  type UserAppReturn,
  type UserAppsSync,
  useUserAppsStore,
} from "~/lib/state/userApps";
import { DEFAULT_TICKERS } from "~/lib/types";
import { createURL, createURLString, processWidgetId, uuidv4 } from "~/lib/utils";
import queryClient from "~/queryClient";
import type {
  Challenges,
  Detail,
  DeveloperOnboardingQuestions,
  EnabledBundles,
  MetaDataWidgetType,
  ProLogin2FAResponse,
  ProLoginResponse,
  Prompt,
  ProUserResponse,
  Skill,
  SkillCreate,
  SuccessReturn,
  Walkthroughs,
  WidgetMetadataResponse,
} from "~/types/auth.type";
import { handleWidgetMetadata } from "~/utils/dataConnectorsHelpers";
import { formatZodErrorMessage } from "~/utils/zodErrors";
import { apiClient } from "./api";

/* Login */

export interface PostApiSource {
  name: string;
  url: string;
  endpointHeaders?: { key: string; value: string; location?: "headers" | "query" }[];
  vendorAppUuid?: string;
}

export type PostFileWidget = Omit<PostApiSource, "vendorAppUuid"> &
  WidgetMetadata & {
    stored_file_uuid?: string;
    extension: Extension;
    dataKey: null | string;
    originalFileName: null | string;
    source?: null | string;
  };

export type PostSingleWidget = WidgetMetadata & {
  endpoint: string;
  name: string;
  gridData: null | object;
  data: null | object;
  endpointHeaders: null | { value?: string; key?: string }[];
  dataKey?: null | string;
  source?: string | string[] | null;
};

export type PostUploadFileResponse = {
  stored_file_uuid: string;
  original_file_name: string;
  extension: Extension;
  url: string;
  failed: boolean;
}[];

export type PutTierResponse = {
  success: boolean;
  entitlement: FeatureFlags;
  is_trial_entity: boolean;
  usage: Usage;
};

export type CustomCopilot = {
  uuid: string;
  url: string;
  headers: Record<string, string>;
  copilots: Copilot[];
  enabled?: boolean;
};

export async function login(
  email: string,
  password: string,
  remember = false,
  totpToken: null | number = null,
): Promise<ProLoginResponse | ProLogin2FAResponse> {
  try {
    const { data, status } = await apiClient.post<ProLoginResponse>("/pro/login", {
      email,
      password,
      remember,
      ip_address: "",
      source: "pro",
      totp_token: totpToken,
      version: VERSION,
    });
    return { status, ...data };
  } catch (e) {
    const { message, detail, ...data } = e?.response?.data || {};
    return {
      ...(data || {}),
      detail: message || detail,
      status: e?.response?.status || 500,
    };
  }
}

/* Validate user */

export async function validateUser() {
  const { data } = await apiClient.get("/pro/validate");
  return data;
}

let logoutCalled = false;

export async function logout() {
  if (logoutCalled) return;

  logoutCalled = true;
  const { data } = await apiClient.post("/pro/logout").catch((e: AxiosError) => {
    console.error("Logout failed:", e);
    const success = [e?.response?.status, e?.status].some((v) => v === 401);
    return { data: { success } as SuccessReturn };
  });
  return data;
}

export async function googleLogin(
  token: string,
  newsletter = false,
): Promise<ProLoginResponse | ProLogin2FAResponse> {
  try {
    const { data, status } = await apiClient.post<ProLoginResponse>(
      "/pro/google-auth",
      { token, version: VERSION, newsletter },
    );
    return { status, ...data };
  } catch (e) {
    const { message, detail, ...data } = e?.response?.data || {};
    return {
      ...(data || {}),
      detail: message || detail,
      status: e?.response?.status || 500,
    };
  }
}

export async function snowflakeLogin(): Promise<
  ProLoginResponse | ProLogin2FAResponse
> {
  try {
    const { data, status } = await apiClient.post<ProLoginResponse>(
      "/pro/snowflake-auth",
      { version: VERSION },
    );
    return { status, ...data };
  } catch (e) {
    const { message, detail, ...data } = e?.response?.data || {};
    return {
      ...(data || {}),
      detail: message || detail,
      status: e?.response?.status || 500,
    };
  }
}

export async function microsoftLogin(
  token: string,
  newsletter = false,
): Promise<ProLoginResponse | ProLogin2FAResponse | Detail> {
  try {
    const { data, status } = await apiClient.post("/pro/microsoft-auth", {
      token,
      version: VERSION,
      newsletter,
    });
    return { status, ...data };
  } catch (e) {
    const { message, detail, ...data } = e?.response?.data || {};
    return {
      ...(data || {}),
      detail: message || detail,
      status: e?.response?.status || 500,
    };
  }
}

export async function oktaLogin(
  token: string,
  newsletter = false,
): Promise<ProLoginResponse | ProLogin2FAResponse | Detail> {
  try {
    const { data, status } = await apiClient.post("/pro/okta-auth", {
      token,
      version: VERSION,
      newsletter,
    });
    return { status, ...data };
  } catch (e) {
    const { message, detail, ...data } = e?.response?.data || {};
    return {
      ...(data || {}),
      detail: message || detail,
      status: e?.response?.status || 500,
    };
  }
}

export async function submitDeveloperOnboardingQuestions(onboardingData: {
  primaryUsage?: string;
  organization?: string;
  organizationName?: string;
  role?: string;
  programmingExperience?: string;
  dataTypes?: string[];
  otherDataType?: string;
  skipOnboarding?: boolean;
}) {
  const { data } = await apiClient.post(
    "/pro/pro-developer-onboarding-info",
    onboardingData,
  );
  return data;
}

export async function getDeveloperOnboardingQuestions(): Promise<DeveloperOnboardingQuestions> {
  const { data } = await apiClient.get("/pro/pro-developer-onboarding-info");
  return data;
}

export async function getCustomCopilotSchema() {
  const { data } = await apiClient.get<CustomCopilot[]>("/pro/custom-copilot");
  return data;
}

export async function removeCustomCopilot(uuid: string) {
  const { data } = await apiClient.delete(`/pro/custom-copilot/${uuid}`);
  return data;
}
export async function putCustomCopilot(copilot: ExternalCopilotHolder) {
  const { data } = await apiClient.put("/pro/custom-copilot", copilot);
  return data;
}

export async function getUserChats(): Promise<{
  chats: Chat[];
}> {
  const { data } = await apiClient.get("/pro/copilot-chats");
  return data;
}

export type ChatUsage = { status?: number; usage?: Usage };
export type PostUserChats = Record<
  string,
  Omit<Chat, "messages"> & {
    messages?: Record<string, Chat["messages"][number] | "DELETE">;
  }
>;

export async function postUserChats(chats: PostUserChats): Promise<ChatUsage> {
  try {
    const usage = await apiClient
      .post<Usage>("/pro/copilot-chats", { chats })
      .then((res) => ({ status: res.status, usage: res.data }))
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 500 };
      });
    return usage;
  } catch (e) {
    console.error("Error posting user chats:", e);
    return { status: e?.response?.status || 500 };
  }
}

type SearchResponse = Omit<Chat<HumanMessage | AIMessage>, "artifacts">[];

export async function searchChats(searchQuery: string) {
  const { data } = await apiClient
    .get<SearchResponse>("/pro/copilot-chats/search", {
      params: { query: searchQuery.trim() },
    })
    .catch((_e: AxiosError) => ({ data: [] as SearchResponse }));

  const results = data.map((chat) => {
    const { messages = [], ...rest } = chat;
    return {
      ...rest,
      recentMessages: messages.map((msg) => msg.content).filter(Boolean),
    } as SearchableChat;
  });

  return { results, searchQuery };
}

export async function getCopilotChat(chatUuid: string): Promise<Chat | null> {
  const { data } = await apiClient
    .get(`/pro/copilot-chats/${chatUuid}`)
    .catch((_e: AxiosError) => ({ data: null }));
  return data;
}

export async function postUserTVState(tvState: TVState): Promise<{ status: number }> {
  try {
    const { status } = await apiClient
      .post("/pro/tv-state", tvState)
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 500 };
      });
    return { status };
  } catch (e) {
    return { status: e?.response?.status || 500 };
  }
}

export async function getUser(): Promise<ProUserResponse> {
  const { data } = await apiClient.get<ProUserResponse>("/pro/user");
  return data;
}

export async function updateZeroToHero(
  challenges: Challenges | Walkthroughs,
): Promise<{ status: number }> {
  try {
    const { status } = await apiClient
      .post("/pro/zero-to-hero", challenges)
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 500 };
      });
    return { status };
  } catch (e) {
    return { status: e?.response?.status || 500 };
  }
}

export async function acceptTerms() {
  const { data } = await apiClient.post("/pro/accepted-pro-tos");
  return data;
}

export async function updatePassword(
  oldPassword: string,
  newPassword: string,
): Promise<number> {
  const { status } = await apiClient
    .put("/user", {
      old_password: oldPassword,
      new_password: newPassword,
    })
    .catch((e: AxiosError) => {
      return { status: e?.response?.status || 500 };
    });
  return status;
}

export async function registerUser(
  email: string,
  newsletter: boolean,
  hearAboutUs: string,
): Promise<{ status: number; detail?: string }> {
  try {
    const { status } = await apiClient.post("/pro/register", {
      email: email,
      newsletter: newsletter,
      hear_about_us: hearAboutUs,
    });
    return { status };
  } catch (e) {
    if (e?.response?.data) {
      const { status, data } = e.response;
      return { status, detail: data.detail };
    }
    return { status: 500, detail: "An unexpected error occurred" };
  }
}

export async function updateFullName(first: string, last: string): Promise<number> {
  try {
    const { status } = await apiClient
      .put("/user", {
        first_name: first,
        last_name: last,
      })
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 500 };
      });
    return status;
  } catch (e) {
    return e.response.status;
  }
}

export async function forgotPassword(
  email: string,
): Promise<{ status: number; detail?: string }> {
  try {
    const { status } = await apiClient.post("/forgot-password", {
      email,
      redirect: "pro",
    });
    return { status };
  } catch (e) {
    if (e?.response?.data) {
      const { status, data } = e.response;
      return { status, detail: data.detail };
    }
    return { status: 500, detail: "An unexpected error occurred" };
  }
}

export async function forgotPasswordConfirmation(
  token: string,
  password: string,
): Promise<number> {
  try {
    const { status } = await apiClient
      .post("/forgot-password-confirmation", {
        token,
        password,
      })
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 500 };
      });
    return status;
  } catch (e) {
    return e.response.status;
  }
}

export async function generateQRCode(): Promise<{
  uri: string;
  secret: string;
} | null> {
  try {
    const { data } = await apiClient.post("/totp");
    return data;
  } catch (_e) {
    return null;
  }
}

export async function activateQRCode(totp_token: number): Promise<number> {
  try {
    const { status } = await apiClient
      .post("/totp/activate", { totp_token })
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 500 };
      });
    return status;
  } catch (e) {
    return e.response.status;
  }
}

export async function getSingleWidgets(): Promise<SingleWidget[]> {
  const { data } = await apiClient.get("/pro/data-connectors/single-widget");
  return data;
}

export async function postSingleWidget(
  sourceUuid: string,
  data: PostSingleWidget,
): Promise<{ status: number }> {
  try {
    const res = await apiClient
      .post(`/pro/data-connectors/single-widget/${sourceUuid}`, { ...data })
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 500 };
      });
    return { status: res.status };
  } catch (e) {
    return { status: e?.response?.status || 500 };
  }
}

export async function deleteSingleWidget(
  widgetUuid: string,
): Promise<{ status: number }> {
  try {
    const { status } = await apiClient
      .delete(`/pro/data-connectors/single-widget/${widgetUuid}`)
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 500 };
      });
    return { status };
  } catch (e) {
    return { status: e?.response?.status || 500 };
  }
}

export async function getApiSources(): Promise<Source[]> {
  const { data } = await apiClient
    .get("/pro/data-connectors/api-source")
    .catch((_e: AxiosError) => {
      // If the request fails, return an empty array
      return { data: [] };
    });
  return data;
}

export async function postApiSource(
  sourceUuid: string,
  data: PostApiSource,
): Promise<{ status: number }> {
  const { status } = await apiClient
    .post(`/pro/data-connectors/api-source/${sourceUuid}`, { ...data })
    .catch((e: AxiosError) => {
      return { status: e?.response?.status || 500 };
    });
  return { status };
}

export async function deleteApiSource(sourceUuid: string): Promise<{ status: number }> {
  const { status } = await apiClient
    .delete(`/pro/data-connectors/api-source/${sourceUuid}`)
    .catch((e: AxiosError) => {
      return { status: e?.response?.status || 500 };
    });
  return { status };
}

export interface Subscription {
  appId: string;
  status: "active" | "disconnected";
  version: string;
  parentAppUuid: string | null;
  latestVersion: string;
  subscribedAt: string;
}

export interface SubscriptionsResponse {
  subscriptions: Subscription[];
  subscribedAppIds: string[];
}

export async function getUserSubscriptions() {
  const { data } = await apiClient
    .get<SubscriptionsResponse>("/marketplace/subscriptions")
    .catch((error) => {
      console.error("Failed to fetch user subscriptions:", error);
      return {
        data: { subscriptions: [], subscribedAppIds: [] } as SubscriptionsResponse,
      };
    });

  return data;
}

export const SUBSCRIPTIONS_QUERY_KEY = ["marketplace", "subscriptions"] as const;

export function invalidateSubscriptions() {
  queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_QUERY_KEY });
}

export async function subscribeListedApp(appId: string) {
  const { data } = await apiClient.post<Subscription>(
    `/marketplace/apps/${appId}/subscribe`,
  );
  if (data?.status === "active") invalidateSubscriptions();
  return data;
}

export async function unsubscribeListedApp(appId: string): Promise<{ status: number }> {
  const { status } = await apiClient
    .delete(`/marketplace/apps/${appId}/subscribe`)
    .catch((e: AxiosError) => ({ status: e?.response?.status || 500 }));

  if (status === 204) invalidateSubscriptions();

  return { status };
}

type StoredFileReturn = {
  uuid: string;
  extension: Extension;
  file_widget_uuid: string | null;
  original_file_name: null | string;
  size: number;
  isGlobal: boolean;
};

type PresignedUrlReturn = {
  pre_signed_url: string;
  stored_file_uuid: string;
  original_file_name: string;
};

export async function getStoredFiles(): Promise<StoredFileReturn[]> {
  const { data } = await apiClient.get<StoredFileReturn[]>("/pro/files");
  return data;
}

export async function getFileWidgets(): Promise<StoredFile[]> {
  const { data } = await apiClient
    .get("/pro/data-connectors/file")
    .catch((_e: AxiosError) => {
      return { data: [] };
    });
  return data;
}

export async function postFileWidget(
  sourceUuid: string,
  data: PostFileWidget,
  signal?: AbortSignal,
): Promise<{ status: number }> {
  const { status } = await apiClient
    .post(`/pro/data-connectors/file/${sourceUuid}`, { ...data }, { signal })
    .catch((e: AxiosError) => {
      return { status: e?.response?.status || 500 };
    });

  return { status };
}

export async function deleteUploadedFile(
  fileUuid: string,
): Promise<{ status: number }> {
  const { status } = await apiClient
    .delete(`/pro/files/${fileUuid}`)
    .catch((e: AxiosError) => {
      return { status: e?.response?.status || 500 };
    });

  return { status };
}

export async function getStoredFileBlob(fileUrl: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(fileUrl, { responseType: "blob" });
  return data;
}

export async function getPreSignedUrl(
  fileUuid: string,
  expiration = 3600,
): Promise<PresignedUrlReturn> {
  const { data } = await apiClient
    .get<PresignedUrlReturn>(`/pro/files/${fileUuid}/presigned-url`, {
      params: { expiration },
    })
    .catch((_e: AxiosError) => {
      return { data: {} as PresignedUrlReturn };
    });
  return data;
}

export async function deleteUploadedFiles(
  fileUuids: string[],
): Promise<{ status: number }> {
  const { status } = await apiClient
    .delete("/pro/files", { data: { file_uuids: fileUuids } })
    .catch((e: AxiosError) => {
      return { status: e?.response?.status || 500 };
    });

  return { status };
}

export async function deleteFileWidget(
  sourceUuid: string,
): Promise<{ status: number }> {
  try {
    const { status } = await apiClient
      .delete(`/pro/data-connectors/file/${sourceUuid}`)
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 500 };
      });
    return { status };
  } catch (e) {
    return { status: e?.response?.status || 500 };
  }
}

export async function migrateDefaultTicker(defaultTicker: Ticker): Promise<Ticker> {
  return await fetchQuerySymbols({
    queryParams: {
      q: defaultTicker?.symbol,
    },
  })
    .then(async ({ results }) => {
      const newTicker = resultsToTicker(results).find(
        (result) => result?.symbol === defaultTicker?.symbol,
      );
      return newTicker || DEFAULT_TICKERS.AAPL;
    })
    .catch(() => DEFAULT_TICKERS.AAPL);
}

export function isValidMainTicker(ticker: any): ticker is Ticker {
  return Object.keys(DEFAULT_TICKERS.AAPL).every(
    (key) => key in ticker && typeof ticker[key] === typeof DEFAULT_TICKERS.AAPL[key],
  );
}

export async function bookDemo(data: {
  used_before?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  message?: string;
}): Promise<number> {
  try {
    const { status } = await apiClient
      .post("/pro/book-demo", data)
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 499 };
      });
    return status;
  } catch (e) {
    return e?.response?.status || 499;
  }
}

export async function getWidgetMetadata(
  widgetType?: MetaDataWidgetType,
  name?: string | null,
  widgetId?: string | null,
): Promise<WidgetMetadataItem[]> {
  const params = new URLSearchParams();
  if (widgetType) params.append("widget_type", widgetType);
  if (name) params.append("name", name);
  if (widgetId) params.append("widget_id", widgetId);

  const { data } = await apiClient.get<WidgetMetadataItem[]>("/pro/widget-metadata", {
    params,
  });
  return data;
}

export async function postWidgetMetadata(
  widgetMetadata: WidgetMetadataResponse,
): Promise<SuccessReturn> {
  const { data } = await apiClient.post<SuccessReturn>(
    "/pro/widget-metadata",
    widgetMetadata,
  );
  return data;
}

export async function getUserAppsData(): Promise<UserAppsSync> {
  const { data } = await apiClient.get<UserAppsSync>("/pro/user-apps/sync");
  return data;
}

export async function syncUserApps(updateUserApps?: (apps: UserAppsSync) => void) {
  const data = await getUserAppsData();
  if (updateUserApps) return updateUserApps(data);

  useUserAppsStore.getState().updateUserApps(data);
}

export async function postUserApp(
  app_uuid: string,
  userApp: UserAppReturn["content"],
): Promise<UserAppsSync> {
  const { data } = await apiClient.post<UserAppsSync>(
    `/pro/user-apps/${app_uuid}`,
    userApp,
  );
  return data;
}

export async function deleteUserApp(uuid: string): Promise<UserAppsSync> {
  const { data } = await apiClient.delete<UserAppsSync>(`/pro/user-apps/${uuid}`);

  return data;
}

export async function getUserAppShares(userAppUuid: string) {
  const { data } = await apiClient.get(`/pro/user-apps/${userAppUuid}/shares`);
  return data;
}

export async function shareUserApp(userAppUuid: string, emails: string) {
  // Split the emails string into an array
  const emailArray = emails.split(",");

  // Convert the email array into the required shares object format
  const shares = emailArray.reduce((acc, email) => {
    acc[email] = "view"; // Assuming "view" is the desired permission for all
    return acc;
  }, {});

  // Make the API call
  const { data } = await apiClient
    .post(`/pro/user-apps/${userAppUuid}/share`, {
      shares,
    })
    .catch((e) => {
      if (e?.response?.data) {
        const { data } = e.response;
        const success = data?.success ?? false;
        return { data: { success, detail: data.detail } };
      }
      return { data: { success: false, detail: "Unable to share dashboard" } };
    });

  return data;
}

export async function deleteUserAppShare(
  userAppUuid: string,
  emails: string[],
): Promise<SuccessReturn & Detail> {
  const url = `/pro/user-apps/${userAppUuid}/share`;

  const { data } = await apiClient
    .delete(url, {
      data: { shares: emails },
    })
    .catch((e) => {
      if (e?.response?.data) {
        const { data } = e.response;
        const success = data?.success ?? false;
        return { data: { success, detail: data.detail } };
      }
      return { data: { success: false, detail: "Unable to share dashboard" } };
    });

  return data;
}

export async function getUserAppShareUsers(userAppUuid: string) {
  const { data } = await apiClient.get(`/pro/user-apps/${userAppUuid}/shares/users`);
  return data;
}

export async function patchWidgetMetadata(
  widgetMetadata: Partial<WidgetMetadataResponse>,
  widgetId?: string,
  widgetType?: MetaDataWidgetType,
  name?: string,
): Promise<SuccessReturn> {
  const params = new URLSearchParams();
  if (widgetId) params.append("widget_id", widgetId);
  if (widgetType) params.append("widget_type", widgetType);
  if (name) params.append("name", name);

  const { data } = await apiClient.patch<SuccessReturn>(
    "/pro/widget-metadata",
    widgetMetadata,
    { params },
  );
  return data;
}

export async function deleteWidgetMetadata(
  widgetId: string,
): Promise<WidgetMetadataItem[]> {
  const { data } = await apiClient.delete<WidgetMetadataItem[]>(
    `/pro/widget-metadata/${widgetId}`,
  );
  return data;
}

export async function putTier(payload: { tier: string }): Promise<PutTierResponse> {
  try {
    const { data } = await apiClient.put<PutTierResponse>("/pro/tier", payload);
    return {
      success: true,
      entitlement: data.entitlement,
      usage: data.usage,
      is_trial_entity: data.is_trial_entity,
    };
  } catch (error) {
    console.error("Error updating tier:", error);
    return {
      success: false,
      entitlement: {} as FeatureFlags,
      usage: {} as Usage,
      is_trial_entity: false,
    };
  }
}

export async function userHasEntity(): Promise<{ success: boolean }> {
  const { data } = await apiClient.get("/pro/user-has-entity");
  return data;
}

export async function getEnabledBundles(): Promise<EnabledBundles> {
  const { data } = await apiClient.get<EnabledBundles>("/pro/enabled-bundles");
  return data;
}

export async function putEnabledBundles(
  bundles: EnabledBundles,
): Promise<SuccessReturn> {
  const { data } = await apiClient.put<SuccessReturn>("/pro/enabled-bundles", bundles);
  return data;
}

export async function getUsage(): Promise<Usage> {
  const { data, status } = await apiClient
    .get<Usage>("/pro/usage")
    .catch((e: AxiosError) => {
      return { status: e?.response?.status || 500, data: {} as Usage };
    });

  return data;
}

export const postUserPrompts = async (prompts: Prompt[]): Promise<SuccessReturn> => {
  const { data } = await apiClient.post<SuccessReturn>("/pro/prompts", prompts);
  return data;
};

export const getUserPrompts = async (): Promise<Prompt[]> => {
  const { data } = await apiClient.get<Prompt[]>("/pro/prompts");
  return data;
};

export const createUserSkill = async (skill: SkillCreate) => {
  const { data } = await apiClient
    .post<Skill[]>("/pro/skills", skill)
    .catch((e: AxiosError) => ({ data: null, status: e?.response?.status || 500 }));
  return data;
};

export const deleteUserSkills = async (skillId: string | string[]) => {
  const skillIds = Array.isArray(skillId) ? skillId : [skillId];
  const { data } = await apiClient
    .delete<Skill[]>("/pro/skills", { data: skillIds })
    .catch((e: AxiosError) => ({ data: null, status: e?.response?.status || 500 }));
  return data;
};

export const updateUserSkill = async (skillId: string, skill: SkillCreate) => {
  const { data } = await apiClient
    .patch<Skill[]>(`/pro/skills/${skillId}`, skill)
    .catch((e: AxiosError) => ({ data: null, status: e?.response?.status || 500 }));
  return data;
};

export const getUserSkills = async () => {
  const { data } = await apiClient.get<Skill[]>("/pro/skills");
  return data;
};

export async function putUser2FA(payload: {
  two_factor_auth: boolean;
}): Promise<SuccessReturn> {
  const { data } = await apiClient.put<SuccessReturn>("/pro/2fa", payload);
  return data;
}

export async function getUser2FA(): Promise<{
  data: {
    two_factor_auth: boolean;
    entity_require_authenticator: boolean;
  };
}> {
  const { data } = await apiClient.get<{
    two_factor_auth: boolean;
    entity_require_authenticator: boolean;
  }>("/pro/2fa");
  return { data };
}

export function getAgentConnectionErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Could not connect to the agent server. Please try again.";
  }

  const message = error.message?.trim();
  if (!message) {
    return "Could not connect to the agent server. Please try again.";
  }

  if (error.name === "AbortError") {
    return message;
  }

  const lowered = message.toLowerCase();
  const isNetworkFailure =
    message === "Failed to fetch" ||
    message === "Load failed" ||
    message === "NetworkError when attempting to fetch resource." ||
    lowered.includes("failed to fetch") ||
    lowered.includes("networkerror");

  if (isNetworkFailure) {
    return "Could not reach the agent server. Check the URL, ensure the server is running, and allow CORS from this app origin.";
  }

  if (lowered.includes("cors")) {
    return "The agent server blocked the request (CORS). Allow this app origin and try again.";
  }

  return message;
}

export async function fetchAgentsData(
  holder: Partial<CustomCopilot>,
  signal?: AbortSignal,
): Promise<Copilot[]> {
  const { headers } = convertHeadersToRecord(holder?.headers ?? {});
  const initRequest: RequestInit = { headers, signal };

  let res: Response;
  try {
    // Try agents.json first, then fall back to copilots.json for backward compatibility
    res = await fetch(createURL("agents.json", holder.url), initRequest).then((res) =>
      res.ok ? res : fetch(createURL("copilots.json", holder.url), initRequest),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    throw new Error(getAgentConnectionErrorMessage(error));
  }

  if (!res.ok) {
    switch (res.status) {
      case 401: {
        throw new Error("Unauthorized access to the copilot URL.");
      }
      case 404: {
        throw new Error("A valid /agents.json was not found.");
      }
      case 500: {
        throw new Error("Internal server error.");
      }
      default: {
        throw new Error("Unknown error occurred while validating URL.");
      }
    }
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(
      "Invalid response from the agent server. Expected valid JSON in /agents.json.",
    );
  }

  const rawAgents = data as Record<string, Copilot>;
  const dataArray = Object.entries(rawAgents).map(
    ([id, copilot]: [string, Copilot]) => {
      // Ensure copilot has a valid URL for endpoints
      for (const [key, value] of Object.entries(copilot?.endpoints || {})) {
        copilot.endpoints[key] = createURLString(value, holder.url);
      }
      if (copilot.image) copilot.image = createURLString(copilot.image, holder.url);
      return { id, ...copilot, headers, holderUuid: holder?.uuid };
    },
  );

  try {
    return z.array(copilotSchema).parse(dataArray);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        "Invalid agents schema from the server. Please validate your /agents.json format.",
      );
    }
    throw error;
  }
}

export function hasCopilotConflict(
  copilots: Copilot[],
  existingCopilots: Copilot[],
  silent = false,
) {
  for (const newAgent of copilots) {
    const { duplicateNames, duplicateIds } = existingCopilots.reduce(
      (acc, agent) => {
        if (agent.name.toLowerCase() === newAgent.name.toLowerCase()) {
          acc.duplicateNames.push(agent.name);
        }
        if (agent.id === newAgent.id) {
          acc.duplicateIds.push(agent.id);
        }
        return acc;
      },
      { duplicateNames: [] as string[], duplicateIds: [] as string[] },
    );
    const conflicts = {
      ID: duplicateIds.length > 0 && `\`${newAgent.id}\``,
      name: duplicateNames.length > 0 && `\`${newAgent.name}\``,
    };

    if (conflicts.ID || conflicts.name) {
      const { labels, conflictMessages } = Object.entries(conflicts)
        .filter(([, value]) => value)
        .reduce(
          (acc, [key, value]) => {
            acc.labels.push(key);
            acc.conflictMessages.push(`${key} ${value}`);
            return acc;
          },
          { labels: [] as string[], conflictMessages: [] as string[] },
        );
      if (silent) return true;

      toast.error(`Agent ${labels.join(" and ")} conflict`, {
        description: formatZodErrorMessage(
          `\nThe agent ${conflictMessages.join(" and ")} already exist. Please ensure each agent has a unique ${labels.join(" and ")}.`,
        ),
      });
      return true;
    }
  }

  return false;
}

export async function getExternalCopilotHolders(
  customCopilots?: CustomCopilot[],
  updateHolders?: (holders: ExternalCopilotHolder[]) => void,
) {
  if (!customCopilots || customCopilots.length === 0) {
    customCopilots = await getCustomCopilotSchema();
  }

  const externalCopilotHolders = await Promise.all(
    customCopilots.map(async (holder): Promise<ExternalCopilotHolder> => {
      try {
        const copilots = await fetchAgentsData(holder);
        const hasConflict = hasCopilotConflict(
          copilots,
          customCopilots
            .flatMap((h) => h.copilots || [])
            .filter((c) => c.holderUuid !== holder.uuid),
          true,
        );
        if (hasConflict)
          return {
            status: "error",
            enabled: holder.enabled !== false,
            ...holder,
          };

        // Update the custom copilot in the database
        putCustomCopilot({ ...holder, copilots });

        return {
          status: "success",
          enabled: holder.enabled !== false,
          ...holder,
          copilots,
        };
      } catch (err) {
        console.error("Error fetching custom agents:", err);

        const hasCopilots =
          Array.isArray(holder.copilots) && holder.copilots.length > 0;
        const currentCopilots = hasCopilots ? holder.copilots : [];
        for (const copilot of currentCopilots) copilot.holderUuid = holder.uuid;

        const hasConflict = hasCopilotConflict(
          currentCopilots,
          customCopilots
            .flatMap((h) => h.copilots || [])
            .filter((c) => c.holderUuid !== holder.uuid),
          true,
        );
        if (!hasConflict) holder.copilots = currentCopilots;

        return {
          status: "error",
          enabled: holder.enabled !== false,
          ...holder,
        };
      }
    }),
  );

  updateHolders?.(externalCopilotHolders);
  return externalCopilotHolders;
}

export async function createMetaDataWidget(widget: WidgetT | WidgetJsonT) {
  const widgetInfo = processWidgetId(widget.widgetId, widget.connectionType);
  const metadata = handleWidgetMetadata(widget as WidgetT);

  if (metadata) return;

  const widgetMetadata = {
    name: widget?.name,
    description: widget?.description ?? "",
    category: widget?.category ?? "",
    subCategory: widget?.subCategory ?? "",
    source: widget?.source ?? "",
    storage: widget.storage,
  } as WidgetMetadataItem;

  let widgetId: WidgetId | undefined;
  try {
    const id = widgetInfo?.uuid || uuidv4();
    const widgetType = widgetInfo.cleanWidgetId as MetaDataWidgetType;

    if (widgetType === "widget_studio") widgetMetadata.widgetConfig = widget as WidgetT;

    const result = await postWidgetMetadata({
      ...widgetMetadata,
      widgetId: id,
      widgetType: widgetType,
    });
    widgetId = `${widgetType}-${id}`;
    if (!result.success) {
      throw new Error("Failed to create widget metadata");
    }
  } catch (error) {
    console.error("Error creating widget metadata:", error);
  } finally {
    if (widgetId) {
      const updatedMetadata = await getWidgetMetadata();
      useBackendConnectorStore.getState().setWidgetMetadata(updatedMetadata);
    }
  }

  return widgetId;
}

export async function getEntityThemeSettings(): Promise<EntityThemeSettings> {
  const { data } = await apiClient
    .get<EntityThemeSettings>("/pro/theme-settings")
    .catch((_e: AxiosError) => {
      return { data: { light: null, dark: null } };
    });
  return data;
}

export async function postMCPServers(
  servers: McpServer[],
): Promise<{ status: number }> {
  try {
    const { status } = await apiClient
      .post("/pro/mcp-servers", { servers })
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 500 };
      });
    return { status };
  } catch (e) {
    return { status: e?.response?.status || 500 };
  }
}

export type NewsletterData = {
  email_newsletter?: boolean;
  email_academia?: boolean;
  email_bot?: boolean;
  email_prowaitlist?: boolean;
};

export async function getNewsletters(): Promise<NewsletterData> {
  const { data } = await apiClient
    .get<NewsletterData>("/marketing")
    .catch((_e: AxiosError) => {
      return {
        data: {
          email_newsletter: false,
          email_academia: false,
          email_bot: false,
          email_prowaitlist: false,
        } as NewsletterData,
      };
    });
  return data;
}

export async function putNewsletters(
  payload: NewsletterData,
): Promise<{ status: number }> {
  try {
    const { status } = await apiClient
      .put("/marketing", payload)
      .catch((e: AxiosError) => {
        return { status: e?.response?.status || 500 };
      });
    return { status };
  } catch (e) {
    return { status: e?.response?.status || 500 };
  }
}
