import { type UseQueryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useWidgetContext } from "~/components/Widget.context";
import { cleanSearchParams, convertHeadersToRecord } from "~/lib/utils/widgetParams";
import { REFRESH_WIDGET_INTERVAL } from "./constants";
import { getConfig } from "./runtimeConfig";
import { useAuthStore, useShallowAuthStore } from "./state/auth";
import { useShallowBackendConnectorStore } from "./state/backendConnector";
import { useShallowPermissionsStore } from "./state/permissions";
import { resolveCronRefetchInterval } from "./utils/cronSchedule";

export {
  cleanSearchParams,
  convertHeadersToRecord,
} from "~/lib/utils/widgetParams";

// File widgets persist the absolute URL the backend minted at upload time
// (built from the backend's SELFURL, which still points at payments.openbb.*)
const LEGACY_FILE_URL_ORIGIN =
  /^https:\/\/payments\.openbb\.(co|dev)(?=\/pro\/files\/)/;

function isBackendOrigin(url: string) {
  return (
    url?.includes(getConfig().urls.backend) || LEGACY_FILE_URL_ORIGIN?.test(url || "")
  );
}

export type TResponseCb<TData> = (
  data: Response,
  resolve: (data: TData | Promise<TData>) => void,
  reject: (reason?: any) => void,
) => Promise<void>;

export interface QueryOptions<TQueryFnData = any | any[]> {
  url: string;
  endpointHeaders?: Record<string, string>;
  params?: { [key: string]: any };
  method?: "GET" | "POST";
  body?: object; // If the body is sent it is a POST request, otherwise it is a GET request
  asText?: boolean; // If asText is true, the response will be returned as text instead of JSON
  responseCb?: TResponseCb<TQueryFnData>; // Custom resolve callback to handle the response before resolving the promise
  addBearerToken?: boolean; // Adds User Bearer token to the request Authorization header
  queryKey?: any[];
  onError?: (error: Error) => void;
  ignoreRefresh?: boolean;
  /** @deprecated - use endpointHeaders instead */
  headers?: never;
  /** @deprecated - use method instead */
  endpointMethod?: never;
}

export function useJsonData<
  TQueryFnData = any | any[],
  TError = Error,
  TData = TQueryFnData,
  T extends QueryOptions<TQueryFnData> = QueryOptions<TQueryFnData>,
>(
  queryOptions: T,
  options?: Omit<UseQueryOptions<TQueryFnData, TError, TData>, "queryKey">,
) {
  const {
    url,
    endpointHeaders,
    params = {},
    method = "GET",
    body,
    asText = false,
    responseCb,
    addBearerToken = true,
    queryKey,
    onError,
    ignoreRefresh = false,
  } = queryOptions;
  // Convert endpointHeaders to Record format if necessary
  const userToken = useShallowAuthStore((authState) => authState.user?.token);
  const { headers, newParams } = convertHeadersToRecord(endpointHeaders, params);
  const {
    widget: {
      id: uuId,
      type: widgetType,
      external,
      refreshQuery,
      staleTime,
      refetchInterval,
      sourceId,
      widgetId,
      isSharedWidget,
      sourceName,
    } = {},
    activeDashboardId,
  } = useWidgetContext(true);

  // Check if the widget has permission before making the API call
  const hasAccess = useShallowPermissionsStore((state) =>
    isSharedWidget
      ? state.hasAccess(sourceId, widgetId.replace(`${sourceName}-`, ""))
      : true,
  );
  const removedApp = url === "" && external && sourceName;

  const withAuth = addBearerToken && isBackendOrigin(url);
  const updateQueuedRefreshId = useShallowBackendConnectorStore(
    (state) => state.updateQueuedRefreshId,
  );

  const resolveCallback = useCallback<TResponseCb<TQueryFnData>>(
    async (response, resolve, reject) => {
      if (responseCb) {
        try {
          await responseCb(response, resolve, reject);
        } catch (error) {
          onError?.(error);
          reject(error);
        }
        return;
      }
      // Read the response once and use it for both logging and refresh logic
      try {
        const data = asText ? await response.text() : await response.json();

        if (
          !(asText || Array.isArray(data)) &&
          data?.refreshBackend !== undefined &&
          sourceId
        ) {
          // Add or remove the sourceId from the queued refresh ids
          updateQueuedRefreshId(sourceId, data?.refreshBackend);
        }

        resolve(data);
      } catch (error) {
        onError?.(error);
        reject(error);
      }
    },
    [asText, responseCb, onError, sourceId],
  );

  // Clean the URL and add any query parameters
  const cleanUrl = cleanSearchParams(url, newParams);
  const headerKeys = Object.keys(headers || {});

  const finalQueryKey = queryKey ?? [
    "json",
    activeDashboardId ?? "",
    cleanUrl || uuId,
    method,
    body ? JSON.stringify(body) : "",
    headerKeys ? JSON.stringify(headerKeys) : "",
    ...(widgetType === "ssrm_advanced" ? [uuId] : []),
    ...(ignoreRefresh ? [] : [refreshQuery ?? 0]),
    hasAccess,
  ];

  return useQuery<TQueryFnData, TError, TData>({
    queryKey: finalQueryKey,
    queryFn: ({ signal }) =>
      new Promise((resolve, reject) => {
        if (!hasAccess) {
          return reject(new Error("User does not have access to this widget"));
        }

        fetch(cleanUrl, {
          headers: {
            ...headers,
            ...(withAuth && userToken ? { Authorization: `Bearer ${userToken}` } : {}),
          },
          method,
          signal,
          body: body && method === "POST" ? JSON.stringify(body) : undefined,
        })
          .then(async (r) => {
            const noContent = r.status === 204;
            if (!r.ok || noContent) {
              let error: any;

              try {
                error = await r.json();
              } catch (_) {
                return reject(r.statusText);
              }

              const warnings = error?.warnings;

              if (warnings?.length)
                for (const warning of warnings) console.warn(warning);

              const errorDetail =
                error?.detail || error?.message || error?.error || error;

              const errorMessage =
                typeof errorDetail === "string"
                  ? errorDetail
                  : JSON.stringify(errorDetail);

              const errorObj = new Error(errorMessage, {
                cause: error?.error_kind || error?.status || "unknown",
              });

              onError?.(errorObj);
              return reject(errorObj);
            }

            resolveCallback(r, resolve, reject);
          })
          .catch((error) => {
            onError?.(error);
            reject(error);
          });
      }),
    enabled: !removedApp && !!cleanUrl && hasAccess,
    staleTime: staleTime ?? 1000 * 60 * 5,
    retry: 1,
    retryDelay: 1000,
    ...(options ?? {}),
    refetchInterval: resolveCronRefetchInterval(
      refetchInterval,
      options?.refetchInterval ?? REFRESH_WIDGET_INTERVAL,
    ),
  });
}

export function fetchWithToken(
  url: string | URL,
  options: RequestInit = {},
  signal?: AbortSignal,
) {
  const token = useAuthStore.getState().user?.token;

  if (!token) return Promise.reject(new Error("No token found"));
  return fetch(url, {
    ...(options ?? {}),
    headers: {
      ...(options?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
    signal,
  });
}

export function useMultipleQueries<
  TQueryFnData = any | any[],
  TError = Error,
  TData = TQueryFnData,
>(
  queriesOptions: QueryOptions<TQueryFnData>[],
  options?: Omit<UseQueryOptions<TQueryFnData, TError, TData>, "queryKey">,
) {
  const {
    widget: { id: uuId, refreshQuery, staleTime, refetchInterval } = {},
    activeDashboardId,
  } = useWidgetContext(true);

  const queries = queriesOptions.map((queryOption) => {
    const {
      url,
      endpointHeaders,
      params = {},
      method = "GET",
      body,
      asText = false,
      responseCb,
      addBearerToken = true,
      queryKey,
      onError,
    } = queryOption;
    // Convert endpointHeaders to Record format if necessary
    const userToken = "";
    const { headers, newParams } = convertHeadersToRecord(endpointHeaders, params);
    const withAuth = addBearerToken && isBackendOrigin(url);

    const resolveCallback = async (response, resolve, reject) => {
      if (responseCb) {
        try {
          await responseCb(response, resolve, reject);
        } catch (error) {
          onError?.(error);
          reject(error);
        }
        return;
      }
      resolve(asText ? response.text() : response.json());
    };

    // Clean the URL and add any query parameters
    const cleanUrl = cleanSearchParams(url, newParams);

    const finalQueryKey = queryKey ?? [
      "json",
      activeDashboardId ?? "",
      cleanUrl || uuId,
      body ? JSON.stringify(body) : "",
      refreshQuery ?? 0,
    ];

    return {
      queryKey: finalQueryKey,
      queryFn: ({ signal }) =>
        new Promise((resolve, reject) =>
          fetch(cleanUrl, {
            headers: {
              ...headers,
              ...(withAuth && userToken
                ? { Authorization: `Bearer ${userToken}` }
                : {}),
            },
            method,
            signal,
            body: method === "POST" ? JSON.stringify(body) : undefined,
          })
            .then(async (r) => {
              const noContent = r.status === 204;
              if (!r.ok || noContent) {
                let error: any;

                try {
                  error = await r.json();
                } catch (_) {
                  return reject(r.statusText);
                }

                const warnings = error?.warnings;

                if (warnings?.length)
                  for (const warning of warnings) console.warn(warning);

                const errorDetail =
                  error?.detail || error?.message || error?.error || error;

                const errorMessage =
                  typeof errorDetail === "string"
                    ? errorDetail
                    : JSON.stringify(errorDetail);

                const errorObj = new Error(errorMessage, {
                  cause: error?.error_kind || error?.status || "unknown",
                });

                onError?.(errorObj);
                return reject(errorObj);
              }

              resolveCallback(r, resolve, reject);
            })
            .catch((error) => reject(error)),
        ),
      enabled: !!cleanUrl,
      staleTime: staleTime ?? 1000 * 60 * 5,
      retry: 1,
      retryDelay: 1000,
      ...(options ?? {}),
      refetchInterval: resolveCronRefetchInterval(
        refetchInterval,
        options?.refetchInterval ?? REFRESH_WIDGET_INTERVAL,
      ),
    } as UseQueryOptions<TQueryFnData, TError, TData>;
  });

  const { refetchInterval: _, ...restOptions } = options ?? {};

  return useQueries({
    queries,
    ...restOptions,
  });
}
