import type { TSaveAs } from "~/components/DataConnectors/NamePopup";
import { useAuthStore } from "~/lib/state/auth";
import {
  type Database,
  type SnowflakeDatabase,
  useDataConnectorStore,
} from "~/lib/state/dataConnector";

export interface SQLDatabase {
  name: string;
  database_type: string;
  username: string;
  password: string;
  host: string;
  database: string;
  query: string;
}

export interface SnowDatabase {
  name?: string;
  username: string;
  password: string;
  account_identifier: string;
  role?: string;
  warehouse?: string;
  schema?: string;
  database?: string;
  query?: string;
}

interface DatabaseNonsensitive {
  name: string;
  database: string;
  query: string;
}

type HandledFetch<T> = Promise<{ detail: string } | T>;

export type SnowflakeValidate =
  | { database: string; schema: string; table: string }[]
  | null;

export type DBType = "database" | "snowflake";
export type DatabaseT<T extends DBType> = T extends "database"
  ? Database
  : SnowflakeDatabase;

const noConnectorDetail = { detail: "No data connector URL" };

// In these endpoints, a response of null means an error occurred

function getHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function errorResponse(text: string): { detail: string } {
  return { detail: `Failed to fetch ${text}` };
}

function getBaseURL(type: DBType) {
  const { user } = useAuthStore.getState();
  const { dataConnectorUrl } = useDataConnectorStore.getState();

  const typeToPath = type === "database" ? "sql" : "snowflake";
  const baseURL = dataConnectorUrl
    ? `${dataConnectorUrl.toString()}${typeToPath}`
    : null;
  return { user, baseURL };
}

export async function getDatabases<T extends DBType>(
  type: T,
): Promise<null | DatabaseT<T>[]> {
  const { user, baseURL } = getBaseURL(type);
  if (!baseURL) return null;
  const res = await fetch(`${baseURL}/databases`, {
    method: "GET",
    headers: getHeaders(user.uuid),
  }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json()) as DatabaseT<T>[];
}

export async function getServerDatabases(
  type: DBType,
  data: {
    database_type: "mysql" | "sqlite";
    username: string;
    password: string;
    host: string;
  },
): HandledFetch<string[]> {
  const { user, baseURL } = getBaseURL(type);
  if (!baseURL) return noConnectorDetail;
  const res = await fetch(`${baseURL}/databases`, {
    method: "POST",
    headers: getHeaders(user.uuid),
    body: JSON.stringify(data),
  });
  return await res.json();
}

export async function getServerDatabasesExisting(
  type: DBType,
  id: number,
): HandledFetch<string[]> {
  const { user, baseURL } = getBaseURL(type);
  if (!baseURL) return noConnectorDetail;
  const res = await fetch(`${baseURL}/databases/${id}`, {
    method: "GET",
    headers: getHeaders(user.uuid),
  });
  return await res.json();
}

export async function addDatabase<T extends DBType>(
  type: T,
  data: T extends "database" ? SQLDatabase : SnowDatabase,
): HandledFetch<DatabaseT<T>[]> {
  const { user, baseURL } = getBaseURL(type);
  if (!baseURL) return noConnectorDetail;
  const res = await fetch(`${baseURL}/database`, {
    method: "POST",
    headers: getHeaders(user.uuid),
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) return result;
  return (await getDatabases(type)) as DatabaseT<T>[];
}

export async function addDatabaseExisting<T extends DBType>(
  type: T,
  id: number,
  data: T extends "database" ? Database : SnowDatabase,
): HandledFetch<DatabaseT<T>[]> {
  const { user, baseURL } = getBaseURL(type);
  if (!baseURL) return noConnectorDetail;
  const res = await fetch(`${baseURL}/database/${id}`, {
    method: "POST",
    headers: getHeaders(user.uuid),
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) return result;
  return await getDatabases(type);
}

export async function addDatabaseSaveAs<T extends DBType>(
  type: T,
  id: number,
  values: TSaveAs,
  query: string,
): HandledFetch<DatabaseT<T>[]> {
  const { user, baseURL } = getBaseURL(type);
  if (!baseURL) return noConnectorDetail;
  const { name, category, sub_category, description } = values;

  const res = await fetch(`${baseURL}/database/${id}/saveas`, {
    method: "POST",
    headers: getHeaders(user.uuid),
    body: JSON.stringify({ name, category, sub_category, description, query }),
  });
  const result = await res.json();
  if (!res.ok) return result;
  return await getDatabases(type);
}

export async function updateDatabaseNonsensitive<T extends DBType>(
  type: T,
  id: number,
  data: T extends "database" ? DatabaseNonsensitive : SnowDatabase,
): HandledFetch<DatabaseT<T>[]> {
  const { user, baseURL } = getBaseURL(type);
  if (!baseURL) return noConnectorDetail;
  const res = await fetch(`${baseURL}/database/${id}/nonsensitive`, {
    method: "PATCH",
    headers: getHeaders(user.uuid),
    body: JSON.stringify(data),
  });
  if (!res.ok) return await res.json();
  return await getDatabases(type);
}

export async function updateDatabaseQuery<T extends DBType>(
  type: T,
  id: number,
  query: string,
): HandledFetch<DatabaseT<T>[]> {
  const { user, baseURL } = getBaseURL(type);
  if (!baseURL) return noConnectorDetail;
  const res = await fetch(`${baseURL}/database/${id}/query`, {
    method: "PATCH",
    headers: getHeaders(user.uuid),
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return await res.json();
  return await getDatabases(type);
}

export async function deleteDatabase<T extends DBType>(
  type: T,
  id: number,
): Promise<null | DatabaseT<T>[]> {
  const { user, baseURL } = getBaseURL(type);
  if (!baseURL) return null;
  const res = await fetch(`${baseURL}/database/${id}`, {
    method: "DELETE",
    headers: getHeaders(user.uuid),
  });
  if (!res.ok) return null;
  return await getDatabases(type);
}

export async function deleteDatabaseConnection<T extends DBType>(
  type: T,
  id: number,
): Promise<null | DatabaseT<T>[]> {
  // This doesn't actually delete the connection, just all associated queries
  const { user, baseURL } = getBaseURL(type);
  if (!baseURL) return null;
  const res = await fetch(`${baseURL}/connection/${id}`, {
    method: "DELETE",
    headers: getHeaders(user.uuid),
  });
  if (!res.ok) return null;
  return await getDatabases(type);
}

export async function snowflakeTables(
  data: SnowDatabase,
): HandledFetch<SnowflakeValidate> {
  const { user } = useAuthStore.getState();
  const { dataConnectorUrl } = useDataConnectorStore.getState();
  if (!dataConnectorUrl) return noConnectorDetail;
  try {
    const res = await fetch(
      `${dataConnectorUrl.toString()}snowflake/database/validate`,
      {
        method: "POST",
        headers: getHeaders(user.uuid),
        body: JSON.stringify(data),
      },
    );
    return await res.json();
  } catch {
    return errorResponse("tables");
  }
}

export async function snowflakeTablesExisting(
  id: number,
  role: string,
  warehouse: string,
): HandledFetch<SnowflakeValidate> {
  const { user } = useAuthStore.getState();
  const { dataConnectorUrl } = useDataConnectorStore.getState();
  if (!dataConnectorUrl) return noConnectorDetail;
  try {
    const res = await fetch(
      `${dataConnectorUrl.toString()}snowflake/database/validate/${id}`,
      {
        method: "POST",
        headers: getHeaders(user.uuid),
        body: JSON.stringify({ role, warehouse }),
      },
    );
    return await res.json();
  } catch {
    return errorResponse("tables");
  }
}

export async function snowflakeRoles(data: SnowDatabase): HandledFetch<string[]> {
  const { user } = useAuthStore.getState();
  const { dataConnectorUrl } = useDataConnectorStore.getState();
  if (!dataConnectorUrl) return noConnectorDetail;
  try {
    const res = await fetch(`${dataConnectorUrl.toString()}snowflake/roles`, {
      method: "POST",
      headers: getHeaders(user.uuid),
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch {
    return errorResponse("roles");
  }
}

export async function snowflakeRolesExisting(id: number): HandledFetch<string[]> {
  const { user } = useAuthStore.getState();
  const { dataConnectorUrl } = useDataConnectorStore.getState();
  if (!dataConnectorUrl) return noConnectorDetail;
  try {
    const res = await fetch(`${dataConnectorUrl.toString()}snowflake/roles/${id}`, {
      method: "POST",
      headers: getHeaders(user.uuid),
    });
    return await res.json();
  } catch {
    return errorResponse("roles");
  }
}
export async function snowflakeWarehouses(data: SnowDatabase): HandledFetch<string[]> {
  const { user } = useAuthStore.getState();
  const { dataConnectorUrl } = useDataConnectorStore.getState();
  if (!dataConnectorUrl) return noConnectorDetail;
  try {
    const res = await fetch(`${dataConnectorUrl.toString()}snowflake/warehouses`, {
      method: "POST",
      headers: getHeaders(user.uuid),
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch {
    return errorResponse("warehouses");
  }
}

export async function snowflakeWarehousesExisting(
  id: number,
  role: string,
): HandledFetch<string[]> {
  const { user } = useAuthStore.getState();
  const { dataConnectorUrl } = useDataConnectorStore.getState();
  if (!dataConnectorUrl) return noConnectorDetail;
  try {
    const res = await fetch(
      `${dataConnectorUrl.toString()}snowflake/warehouses/${id}`,
      {
        method: "POST",
        headers: getHeaders(user.uuid),
        body: JSON.stringify({ role }),
      },
    );
    return await res.json();
  } catch {
    return errorResponse("warehouses");
  }
}
interface AgGridOptions {
  startRow: number;
  endRow: number;
  rowGroupCols: any[];
  valueCols: any[];
  pivotCols: any[];
  pivotMode: boolean;
  groupKeys: any[];
  filterModel: any;
  sortModel: any[];
}

export interface DataConnectorResponse {
  rows: number;
  data: object[];
  schema: { [key: string]: string };
  timestamp: number;
}

export async function getDatabaseRows(
  url: URL,
  request?: undefined | AgGridOptions,
  signal?: AbortSignal,
): Promise<null | DataConnectorResponse> {
  const { user } = useAuthStore.getState();
  request.sortModel = request.sortModel?.filter(
    (item) => !item.colId.includes("ag-Grid-AutoColumn"),
  );
  return await fetch(url, {
    method: "POST",
    headers: getHeaders(user.uuid),
    body: request ? JSON.stringify({ request }) : undefined,
    signal,
  })
    .then(async (res) => {
      if (!res.ok) return null;
      return await res.json();
    })
    .catch(() => null);
}

export async function getMetadata(url: string): Promise<{ version: string }> {
  const res = await fetch(url).catch(() => ({ json: () => ({ version: "" }) }));
  return await res.json();
}
