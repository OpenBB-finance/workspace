import type { UseFormReturn } from "react-hook-form";
import {
  type DatabaseT,
  type DBType,
  getDatabases,
  getMetadata,
} from "~/api/dataConnectors";
import type { WidgetT } from "~/components/types";
import {
  type SingleWidget,
  type StoredFile,
  useBackendConnectorStore,
  type WidgetMetadataItem,
} from "~/lib/state/backendConnector";
import { type Database, useDataConnectorStore } from "~/lib/state/dataConnector";
import { processWidgetId } from "~/lib/utils";

export interface Form2Type<T, U> {
  activeItem?: T;
  data?: U;
  setSecondPage: (value: boolean) => void;
  selectItems: string[];
  error: boolean;
}

export interface Form1Type<T> {
  form: UseFormReturn<T>;
  setItems: (databases: string[]) => void;
  setSecondPage: (value: boolean) => void;
  error: boolean;
  goBack: () => void;
}

export function isDatabaseType(type: string): type is DBType {
  return ["database", "snowflake"].includes(type);
}

// This cleans the URL for snowflake account identifier
export function formatUrl(url: string): string {
  const regexPattern = /^https:\/\/(.*?)\.snowflakecomputing\.com$/;
  const match = url.match(regexPattern);
  return match ? match[1] : url;
}

// If the parent's id for the connection happens to match a snowflake id, we
// cannot accidentally edit the wrong thing
export function getActiveItem<T extends DBType>(
  items: DatabaseT<T>[],
  type: T,
  id: number,
  previousData: boolean,
): DatabaseT<T> | undefined {
  if (!previousData) return undefined;
  if (["snowflake", "database"].includes(type)) {
    return items.find((item) => item.id === id);
  }
  if (["snowflake-parent", "database-parent"].includes(type)) {
    return items.find((item) => item.connection === id);
  }
  return undefined;
}

export function getDatabaseDetails(widget: WidgetT): DatabaseT<DBType> | undefined {
  if (!isDatabaseType(widget?.connectionType)) return undefined;

  const { widgetId, connectionType } = widget;
  const id = Number.parseInt(widgetId.split("-")[1], 10);

  const dbData = useDataConnectorStore
    .getState()
    .getDataBaseDetails(connectionType, id);

  return {
    ...dbData,
    // Snowflake doesn't have a database_type field, so we default to connectionType
    database_type: dbData?.database_type ?? connectionType,
    ...(connectionType === "snowflake" && {
      // @ts-expect-error
      schema: dbData?.database_schema,
    }),
  };
}

export async function updateVersion(url: string | undefined) {
  const { setDataConnectorVersion } = useDataConnectorStore.getState();

  if (url)
    getMetadata(url)
      .then(({ version = null }) => version && setDataConnectorVersion(version))
      .catch(console.error);
}

export async function initiateDataConnector(data_connector_url: string | undefined) {
  const { setDataConnectorUrl, setDatabases } = useDataConnectorStore.getState();

  // Update the user's data connector url

  let url: undefined | URL;
  let isOnline = false;
  try {
    url = new URL(data_connector_url);
    const resp = await fetch(url, { signal: AbortSignal.timeout(1000) });
    isOnline = resp?.ok;
  } catch {
    url = undefined;
  }
  setDataConnectorUrl(url);

  if (!isOnline) return;

  if (url) {
    for (const dbType of ["database", "snowflake"] as DBType[]) {
      getDatabases(dbType)
        .then((r) => Array.isArray(r) && setDatabases(dbType, r))
        .catch(console.error);
    }
  }

  updateVersion(url ? url.toString() : undefined);
}

type WidgetMetadataT = WidgetMetadataItem | SingleWidget | StoredFile | Database;
export function handleWidgetMetadata<T extends WidgetMetadataT>(
  widget: WidgetT,
): T | undefined {
  const widgetInfo = processWidgetId(widget.widgetId, widget.connectionType);

  const { getSingleWidgetById, getStoredFileById, getWidgetMetadataById } =
    useBackendConnectorStore.getState();

  if (widget.connectionType === "single") {
    return getSingleWidgetById(widgetInfo.uuid) as T;
  }
  if (widget.connectionType === "file") {
    return getStoredFileById(widgetInfo.uuid) as T;
  }
  if (isDatabaseType(widget.connectionType)) {
    return getDatabaseDetails(widget) as T;
  }
  return getWidgetMetadataById(widgetInfo.uuid) as T;
}
