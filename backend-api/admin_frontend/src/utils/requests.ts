export type RWN = "Read" | "Write" | "None";
export type strBool = "true" | "false";
type RequestInfo = Record<string, string | Record<string, string>>;

export interface User {
  uuid: string;
  accessToken: string;
  email: string;
}

export interface EntityType {
  uuid: string;
  entity_type: string;
  code: string;
  active: boolean;
  permission_hierarchy: number;
}

interface ApiKeys {
  benzinga: string | null;
  intrinio: string | null;
  trading_economics: string | null;
  fmp: string | null;
}

export interface Entity {
  uuid: string;
  name: string;
  email: string | null;
  company_type: string | null;
  organization_size: string | null;
  aum: number | null;
  country: string | null;
  entity_type: EntityType;
  seats: number | null;
  expiration_date: string | null;
  stripe_id: string | null;
  api_keys: ApiKeys;
}

export interface EntityRelationship {
  uuid: string;
  child: Entity;
  parent: Entity;
  supreme: Entity;
}

export interface Entitlements {
  benzinga: RWN;
  polygon: RWN;
  intrinio: RWN;
  fmp: RWN;
  datarade: RWN;
  veraset: RWN;
  alphavantage: RWN;
}

export interface PermissionMap {
  uuid: string;
  entity: Entity;
  entitlements: null | Entitlements;
  name: string;
}

export interface FullUser {
  uuid: string;
  email: string;
  permissions: PermissionMap | null;
  pro_trial_end: Date | null;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
  size: number;
}

export interface AddResponse {
  message?: string;
  success: boolean;
}

export interface AddResponseData<T> extends AddResponse {
  data?: T;
}

interface ListResponse<T> {
  data?: Paginated<T>;
  message?: string;
}

export interface BaseEntity {
  name: string;
  entity_code: string;
  email: string;
  company_type: string;
  organization_size: string;
  aum: number;
  country: string;
  seats: number;
  expiration_date: string;
  stripe_id: string | undefined;
  api_keys: ApiKeys;
}

export interface PostEntity extends BaseEntity {
  admin_email: string;
}

export interface EntitlementBase {
  tier: "pro" | "terminal" | undefined;
  number_copilot_calls_day: number | undefined;
  total_file_upload_size_gb: number | undefined;
  share_widgets: "public" | "private" | undefined;
  bring_your_own_data: boolean | undefined;
  bring_your_own_copilot: boolean | undefined;
  admin_access: boolean | undefined;
  support: boolean | undefined;
  excel_add_in: boolean | undefined;
  data_add_ons_redistribution: boolean | undefined;
  bundle_name: "Default" | "Equity Research" | "Pro Trial" | undefined | null;
}

const baseHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

function fullHeaders(accessToken: string): Record<string, string> {
  return {
    ...baseHeaders,
    Authorization: `Bearer ${accessToken}`,
  };
}

function getRequestInfo(accessToken: string): RequestInfo {
  return {
    headers: fullHeaders(accessToken),
    method: "GET",
  };
}

function postRequestInfo(accessToken: string, body: Record<string, any>): RequestInfo {
  return {
    headers: fullHeaders(accessToken),
    method: "POST",
    body: JSON.stringify(body),
  };
}

async function prettyStatusCodes(res: Response): Promise<AddResponse> {
  if (res.status === 200) {
    return { success: true };
  }

  const failureDict: Record<number, string> = {
    422: "Invalid form data",
    404: "Item does not exist",
    400: "Invalid data sent",
    409: "Item already exists",
  };

  let message = failureDict[res.status];
  if (message === undefined) {
    message = "Unknown error occurred";
  }

  try {
    const jsonRes = await res.json();
    return {
      success: false,
      message: jsonRes.detail ? `${message}: ${jsonRes.detail}` : message
    };
  } catch {
    return { success: false, message };
  }
}

async function extractData<T>(res: Response): Promise<ListResponse<T>> {
  if (res.status === 200) {
    const data = await res.json();
    if (data instanceof Object) {
      return { data };
    }
  }
  return { message: "Failed to get new data" };
}

function createGetUrl(path: string, size: number, page: number): string {
  if (page < 1) page = 1;
  if (size < 1) size = 1;
  return `${baseUrl}/${path}?size=${size}&page=${page}`;
}

const baseUrl = import.meta.env.VITE_API_URL;

export async function apiLogin(
  email: string,
  password: string,
  ipAddress: string,
  rememberMe = true,
): Promise<AddResponseData<User>> {
  const res = await fetch(`${baseUrl}/login`, {
    headers: baseHeaders,
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      remember: rememberMe,
      ip_address: ipAddress,
    }),
  });
  if ([200, 206].includes(res.status)) {
    const data = await res.json();
    if ("access_token" in data) {
      return {
        success: true,
        data: {
          accessToken: data.access_token,
          email,
          uuid: data.uuid,
        },
      };
    }
  } else if (res.status === 403) {
    return {
      success: false,
      message: "Account not confirmed. A new confirmation email has been sent.",
    };
  }
  if (res.status === 401) {
    return {
      success: false,
      message: "Credentials are incorrect",
    };
  }
  if (res.status === 422) {
    return {
      success: false,
      message: "The password or username sent is not valid.",
    };
  }
  return {
    success: false,
    message: "Unknown error occurred",
  };
}

export async function addInstaller(
  objectName: string,
  version: string,
  system: string,
  notes: string,
  itemType: string,
  signature: string,
  accessToken: string,
): Promise<AddResponse> {
  const body = {
    object_name: objectName,
    version,
    system,
    notes,
    item_type: itemType,
    signature,
  };
  const res = await fetch(`${baseUrl}/add-build`, postRequestInfo(accessToken, body));
  return prettyStatusCodes(res);
}

export async function addEntityType(
  entityType: string,
  code: string,
  permissionHierarchy: number,
  accessToken: string,
): Promise<AddResponse> {
  const body = {
    entity_type: entityType,
    code,
    active: true,
    permission_hierarchy: permissionHierarchy,
  };
  const res = await fetch(
    `${baseUrl}/entity/entity-type`,
    postRequestInfo(accessToken, body),
  );
  return prettyStatusCodes(res);
}

export async function addEntity(
  data: PostEntity,
  accessToken: string,
): Promise<AddResponseData<{ entity_uuid: string; permission_map_uuid: string }>> {
  const res = await fetch(
    `${baseUrl}/entity/entity`,
    postRequestInfo(accessToken, data),
  );
  if (res.status === 200) {
    const data = await res.json();
    return { success: true, data };
  }
  const jsonRes = await res.json()

  const statusResponse = await prettyStatusCodes(res);
  return {
    success: statusResponse.success,
    message: jsonRes.detail && statusResponse.message ? `${statusResponse.message}: ${jsonRes.detail}` : statusResponse.message || jsonRes.detail || ""
  };
}

export async function addEntityRelationship(
  parent: string,
  child: string,
  accessToken: string,
): Promise<AddResponse> {
  const body = {
    parent_uuid: parent,
    child_uuid: child,
  };
  const res = await fetch(
    `${baseUrl}/entity/entity-relationship`,
    postRequestInfo(accessToken, body),
  );
  return prettyStatusCodes(res);
}

export async function addPermissionMap(
  entityUUID: string,
  name: string,
  entitlements: Entitlements,
  accessToken: string,
): Promise<AddResponse> {
  const body = { entity_uuid: entityUUID, entitlements, name };
  const res = await fetch(
    `${baseUrl}/entity/entity-map`,
    postRequestInfo(accessToken, body),
  );
  return prettyStatusCodes(res);
}

export async function addUser(
  email: string,
  permissionsUUID: string,
  firstName: null | string,
  lastName: null | string,
  accessToken: string,
): Promise<AddResponse> {
  const body = {
    email,
    permissions_uuid: permissionsUUID,
    first_name: firstName,
    last_name: lastName,
  };
  const res = await fetch(
    `${baseUrl}/entity/register-admin`,
    postRequestInfo(accessToken, body),
  );
  return prettyStatusCodes(res);
}

export async function getEntityTypes(
  accessToken: string,
  size = 1000,
  page = 1,
): Promise<ListResponse<EntityType>> {
  const url = createGetUrl("entity/entity-type", size, page);
  const res = await fetch(url, getRequestInfo(accessToken));
  return await extractData<EntityType>(res);
}

export async function getEntities(
  accessToken: string,
  size = 1000,
  page = 1,
): Promise<ListResponse<Entity>> {
  const url = createGetUrl("entity/entity", size, page);
  const res = await fetch(url, getRequestInfo(accessToken));
  return await extractData<Entity>(res);
}

export async function getEntityRelationships(
  accessToken: string,
  size = 1000,
  page = 1,
): Promise<ListResponse<EntityRelationship>> {
  const url = createGetUrl("entity/entity-relationship", size, page);
  const res = await fetch(url, getRequestInfo(accessToken));
  return await extractData<EntityRelationship>(res);
}

export async function getPermissionMaps(
  accessToken: string,
  size = 1000,
  page = 1,
): Promise<ListResponse<PermissionMap>> {
  const url = createGetUrl("entity/entity-map", size, page);
  const res = await fetch(url, getRequestInfo(accessToken));
  return await extractData<PermissionMap>(res);
}

export async function getUsers(
  accessToken: string,
  size = 50,
  page = 1,
  email?: string,
): Promise<ListResponse<FullUser>> {
  let url = createGetUrl("entity/user", size, page);
  if (email !== undefined) {
    url += `&email=${email}`;
  }
  const res = await fetch(url, getRequestInfo(accessToken));
  return await extractData<FullUser>(res);
}

export async function editEntity(
  uuid: string,
  data: BaseEntity,
  accessToken: string,
): Promise<AddResponse> {
  const res = await fetch(`${baseUrl}/entity/entity/${uuid}`, {
    headers: fullHeaders(accessToken),
    method: "PUT",
    body: JSON.stringify(data),
  });
  return prettyStatusCodes(res);
}

export async function editEntityRelationship(
  uuid: string,
  parentUUID: string,
  childUUID: string,
  accessToken: string,
): Promise<AddResponse> {
  const res = await fetch(`${baseUrl}"/entity/entity-relationship/${uuid}`, {
    headers: fullHeaders(accessToken),
    method: "PUT",
    body: JSON.stringify({
      parent_uuid: parentUUID,
      child_uuid: childUUID,
    }),
  });
  return prettyStatusCodes(res);
}

export async function editEntityType(
  uuid: string,
  entityType: string,
  code: string,
  permissionHierarchy: number,
  accessToken: string,
): Promise<AddResponse> {
  const res = await fetch(`${baseUrl}/entity/entity-type/${uuid}`, {
    headers: fullHeaders(accessToken),
    method: "PUT",
    body: JSON.stringify({
      entity_type: entityType,
      code,
      permission_hierarchy: permissionHierarchy,
      active: true,
    }),
  });
  return prettyStatusCodes(res);
}

export async function editPermissionMap(
  uuid: string,
  entityUUID: string,
  name: string,
  entitlements: Entitlements,
  accessToken: string,
): Promise<AddResponse> {
  const res = await fetch(`${baseUrl}/entity/entity-map/${uuid}`, {
    headers: fullHeaders(accessToken),
    method: "PUT",
    body: JSON.stringify({ entity_uuid: entityUUID, entitlements, name }),
  });
  return prettyStatusCodes(res);
}

export async function editUser(
  uuid: string,
  permissionsUUID: string,
  pro_trial_end: Date | undefined,
  accessToken: string,
): Promise<AddResponse> {
  const res = await fetch(`${baseUrl}/entity/user/${uuid}`, {
    headers: fullHeaders(accessToken),
    method: "PUT",
    body: JSON.stringify({
      permissions_uuid: permissionsUUID,
      pro_trial_end: pro_trial_end,
    }),
  });
  return prettyStatusCodes(res);
}

export async function getEntityEntitlement(
  uuid: string,
  accessToken: string,
): Promise<EntitlementBase> {
  const res = await fetch(
    `${baseUrl}/entity/entitlement/${uuid}`,
    getRequestInfo(accessToken),
  );
  return res.json();
}

export async function patchEntityEntitlement(
  uuid: string,
  entitlement: EntitlementBase,
  update_all: boolean,
  accessToken: string,
): Promise<AddResponse> {
  const res = await fetch(
    `${baseUrl}/entity/entitlement/${uuid}?update_all=${update_all}`,
    {
    headers: fullHeaders(accessToken),
    method: "PATCH",
    body: JSON.stringify(entitlement),
  });
  return prettyStatusCodes(res);
}

export async function getAdminUserEntitlement(
  uuid: string,
  accessToken: string,
): Promise<EntitlementBase> {
  const res = await fetch(
    `${baseUrl}/admin/entitlement/${uuid}`,
    getRequestInfo(accessToken),
  );
  return res.json();
}

export async function patchAdminUserEntitlement(
  uuid: string,
  entitlement: EntitlementBase,
  accessToken: string,
): Promise<AddResponse> {
  const res = await fetch(`${baseUrl}/admin/entitlement/${uuid}`, {
    headers: fullHeaders(accessToken),
    method: "PATCH",
    body: JSON.stringify(entitlement),
  });
  return prettyStatusCodes(res);
}
