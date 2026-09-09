import { useCallback, useMemo } from "react";
import { getApiSources, type PostApiSource, postApiSource } from "~/api/auth.api";
import {
  deleteSourceWidgets,
  updateWidgetEndpoints,
} from "~/components/DataConnectors/common/helpers";
import {
  type Source,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";
import type { ShowNotificationProps } from "~/lib/utils/toast";
import { dispatchSaveState, uuidv4 } from "~/lib/utils/utils";
import { validateSource } from "~/lib/utils/validateBackend";
import {
  appSupportsAnonymousAccess,
  appUsesCustomAuth,
  getListedAppAuthFields,
  type ListedApp,
  type ListedAppAuthValue,
} from "~/types/listedApps";

type ConnectResult = { success: true } | { success: false; error: string };
type ConnectOptions = {
  authValues?: ListedAppAuthValue[];
  validateApiKey?: boolean;
  parentAppUuid?: string;
};

export function useListedAppConnect() {
  const { addApiSource, updateApiSource, deleteApiSource, getApiSourceById } =
    useShallowBackendConnectorStore((state) => ({
      updateApiSource: state.updateApiSource,
      addApiSource: state.addApiSource,
      deleteApiSource: state.deleteApiSource,
      getApiSourceById: state.getApiSourceById,
    }));

  /**
   * Connects (or re-connects) a listed app by upserting its `apiSource` record.
   * Auth values are sent as HTTP headers on every workspace → listed-app request.
   *
   * Flow:
   *  1. Validate — fail fast on bad credentials or unreachable backends.
   *  2. Persist — POST the source (overwrites prior auth via reused `sourceId`).
   *  3. Merge — re-fetch, push into Zustand, update any widgets pointing at it.
   *
   * Anonymous reconnect: apps with `authType` including `"none"` may pass zero
   * auth values to downgrade an authenticated source to anonymous (e.g. when
   * the user clicks "Remove authentication" without unsubscribing). Partial
   * fills (some auth fields populated, some empty) are still rejected.
   *
   * @param options.validateApiKey  Stop after step 1 — used to pre-flight a key
   *   before showing the data-sharing dialog.
   * @param options.parentAppUuid  Linking a child app: reuse the parent
   *   source's existing headers instead of building new ones from `authValues`.
   */
  const connectApp = useCallback(
    async (app: ListedApp, options?: ConnectOptions): Promise<ConnectResult> => {
      const { authValues = [], validateApiKey, parentAppUuid } = options || {};
      const existingSource = getApiSourceById(app.id);
      if (parentAppUuid && !existingSource)
        return { success: false, error: "Parent app source not found." };

      const sourceId = existingSource?.id ?? uuidv4();
      const authFields = getListedAppAuthFields(app);
      const authValueMap = new Map(authValues.map((field) => [field.id, field.value]));

      const authHeaders = authFields.reduce(
        (headers, field) => {
          const rawValue = authValueMap.get(field.id)?.trim();
          if (!rawValue) return headers;

          headers.push({
            key: field.key,
            value: `${field.prefix || ""}${rawValue}`,
            location: "headers",
          });
          return headers;
        },
        [] as NonNullable<Source["endpointHeaders"]>,
      );

      if (appUsesCustomAuth(app) && authFields.length === 0) {
        return {
          success: false,
          error: "This app has invalid custom authentication settings.",
        };
      }

      if (authFields.length > 0 && authHeaders.length !== authFields.length) {
        const isAnonymousReconnect =
          authHeaders.length === 0 && appSupportsAnonymousAccess(app);
        if (!isAnonymousReconnect) {
          return {
            success: false,
            error: "All authentication fields are required.",
          };
        }
      }

      let endpointHeaders: Source["endpointHeaders"] = [
        ...authHeaders,
        { key: "X-OpenBB-Workspace", value: "true", location: "headers" },
        { key: "X-OpenBB-Listed-App-Id", value: app.id, location: "headers" },
      ];

      if (parentAppUuid && existingSource.endpointHeaders?.length > 0) {
        endpointHeaders = existingSource.endpointHeaders.map((header) => {
          if (header.key === "X-OpenBB-Listed-App-Id") {
            return { ...header, value: parentAppUuid };
          }
          return header;
        });
      }

      const data = {
        name: app.appName,
        url: app.backendUrl,
        endpointHeaders,
        vendorAppUuid: parentAppUuid ?? app.id,
      } as PostApiSource;

      try {
        if (app.apiKeyUrl && authHeaders.length > 0) {
          const response = await fetch(app.apiKeyUrl, {
            headers: Object.fromEntries(endpointHeaders.map((h) => [h.key, h.value])),
            signal: AbortSignal.timeout(60_000), // match validateBackend's connect timeout
          });
          if (!response.ok) {
            return {
              success: false,
              error: `${appUsesCustomAuth(app) ? "Authentication" : "API key"} validation failed: ${response.statusText}`,
            };
          }
        } else {
          // Validate first so we fail fast on bad credentials or unreachable backends.
          const { errorMessage } = await validateSource(data as Source, {
            vendorAppCache: true,
            validateAllWidgets: authHeaders.length > 0,
          });
          if (errorMessage) return { success: false, error: errorMessage };
        }

        if (validateApiKey) return { success: true };

        const { status } = await postApiSource(sourceId, data);
        if (status !== 200) {
          return { success: false, error: "Failed to save backend connection." };
        }
        dispatchSaveState();

        const serverSource = (await getApiSources()).find((s) => s.id === sourceId);
        const source = serverSource || ({ id: sourceId, ...data } as Source);
        source.hasApiKey = authHeaders.length > 0;

        const { templates, widgets, errorMessage } = await updateApiSource(source);
        Object.assign(source, {
          templates,
          widgets,
          status: errorMessage ? "error" : "success",
        });

        if (existingSource) {
          updateWidgetEndpoints(source);
          dispatchSaveState();
        }

        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Connection failed.";
        return { success: false, error: message };
      }
    },
    [getApiSourceById, updateApiSource, addApiSource],
  );

  const disconnectApp = useCallback(
    async (app: ListedApp, notify?: ShowNotificationProps) => {
      const source = getApiSourceById(app.id);
      if (source) deleteSourceWidgets(source);
      await deleteApiSource({ vendorAppUuid: app.id }, notify);
    },
    [deleteApiSource, getApiSourceById],
  );

  return useMemo(() => ({ connectApp, disconnectApp }), [connectApp, disconnectApp]);
}
