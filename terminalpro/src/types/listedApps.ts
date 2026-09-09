export type ListedAppAuthType = "api_key" | "none" | "custom";

export type ListedAppAuthField = {
  id: string;
  label: string;
  key: string;
  prefix?: string;
  placeholder?: string;
};

export type ListedAppAuthValue = {
  id: string;
  value: string;
};

export const DEFAULT_LISTED_APP_AUTH_FIELD: ListedAppAuthField = {
  id: "api_key",
  label: "API Key",
  key: "Authorization",
  prefix: "Bearer ",
  placeholder: "ABCD-1234-EFGH-5678-IJKL",
};

/** Per-server auth strategy declared in an app's `mcpServers` entry. */
export type McpServerAuthType = "oauth" | "token";

export type ListedAppMcpServer = {
  name: string;
  description?: string;
  url: string;
  /** Absent or "oauth" keeps the default OAuth flow; "token" uses a static token. */
  authType?: McpServerAuthType;
};

/** Field descriptor for the token modal when an MCP server uses static-token auth. */
export const MCP_TOKEN_AUTH_FIELD: ListedAppAuthField = {
  id: "mcp_token",
  label: "Token",
  key: "Authorization",
  prefix: "Bearer ",
  placeholder: "Paste your access token",
};

export function mcpServerUsesTokenAuth(server: {
  authType?: McpServerAuthType;
}): boolean {
  return server.authType === "token";
}

/** Strips a leading case-insensitive "Bearer " prefix and trims a raw token value. */
export function stripBearerPrefix(value: string): string {
  return value.replace(/^\s*bearer\s+/i, "").trim();
}

export interface ListedApp {
  id: string;
  parentAppUuid?: string;
  vendorName: string;
  appName: string;
  description: string;
  backendUrl: string;
  thumbnail: string;
  thumbnailDark?: string;
  thumbnailLight?: string;
  appImages?: { img: string; img_dark?: string; img_light?: string };
  version?: string;
  apiKeyUrl?: string;
  apiKeyInfoUrl?: string;
  // Fields for details modal
  vendorDescription?: string;
  vendorWebsiteUrl?: string;
  vendorThumbnailUrl?: string;
  contactEmail?: string;
  documentationUrl?: string;
  widgets: { id?: string; name: string; description?: string; count?: number }[];
  totalWidgets?: number;
  prompts?: string[];
  mcpServers?: ListedAppMcpServer[];
  screenshots?: string[];
  /** Media items: images, videos (.mp4/.webm/.mov), or YouTube URLs */
  media?: string[];
  /** Built-in apps (like OpenBB Sandbox) are pre-subscribed */
  isBuiltIn?: boolean;
  /** Determines if the app is in development. If true, the app will only be visible to owner. */
  isDevelopment?: boolean;
  /** Determines how credentials are handled. Defaults to `["api_key"]` if not set. */
  authType?: ListedAppAuthType[];
  /** Custom auth fields rendered when `authType` includes `custom`. */
  authFields?: ListedAppAuthField[];
  /** ISO timestamp when the app listing was created */
  createdDate?: string;
  /** ISO timestamp when the app listing was last updated */
  updatedDate?: string;
  /** Category label shown above the title (e.g., "FLOW & OPTIONS") */
  category?: string;
  /** Short hook shown beneath the title */
  tagline?: string;
}

export interface ListedAppWithKey extends ListedApp {
  userHasAuth?: boolean;
}

export function getListedAppAuthTypes(app: ListedApp): ListedAppAuthType[] {
  return app.authType?.length ? app.authType : ["api_key"];
}

export function appSupportsAnonymousAccess(app: ListedApp): boolean {
  return getListedAppAuthTypes(app).includes("none");
}

export function appUsesCustomAuth(app: ListedApp): boolean {
  return getListedAppAuthTypes(app).includes("custom");
}

export function getListedAppAuthFields(app: ListedApp): ListedAppAuthField[] {
  const types = getListedAppAuthTypes(app);
  if (types.includes("custom")) return app.authFields ?? [];
  if (types.includes("api_key")) return [DEFAULT_LISTED_APP_AUTH_FIELD];
  return [];
}

export function appRequiresAuth(app: ListedApp): boolean {
  return !appSupportsAnonymousAccess(app);
}

export function appHasSavedAuth(
  app: ListedApp,
  endpointHeaders?:
    | { key: string; value: string; location: "headers" | "query" }[]
    | null,
): boolean {
  const authFields = getListedAppAuthFields(app);
  if (authFields.length === 0) return false;

  const headerMap = new Map(
    (endpointHeaders ?? []).map((header) => [header.key.toLowerCase(), header.value]),
  );

  return authFields.every((field) => {
    const value = headerMap.get(field.key.toLowerCase());
    return typeof value === "string" && value.trim().length > 0;
  });
}
