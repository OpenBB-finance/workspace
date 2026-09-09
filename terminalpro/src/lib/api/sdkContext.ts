import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useCallback, useLayoutEffect } from "react";
import { useParams } from "react-router-dom";
import { useWidgetContext } from "~/components/Widget.context";
import type { QueryOperation } from "./sdkComponents";

export type SdkContext = {
  fetcherOptions: {
    /**
     * Headers to inject in the fetcher
     */
    headers?: {};
    /**
     * Query params to inject in the fetcher
     */
    queryParams?: {};
  };
  queryOptions: {
    /**
     * Set this to `false` to disable automatic refetching when the query mounts or changes query keys.
     * Defaults to `true`.
     */
    enabled?: boolean;
  };
  /**
   * Query key manager.
   */
  queryKeyFn: (operation: QueryOperation) => QueryKey;
};

/**
 * Context injected into every react-query hook wrappers
 *
 * @param queryOptions options from the useQuery wrapper
 */
export function useSdkContext<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  _queryOptions?: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    "queryKey" | "queryFn"
  >,
): SdkContext {
  const { id } = useParams();
  const { widgetRef, updateWidget } = useWidgetContext(true);
  const refreshQuery = useWidgetContext(true)?.widget?.refreshQuery;

  const queryKeyFnCallback = useCallback(
    (operation: QueryOperation) => {
      const queryKey = queryKeyFn(operation);

      if (operation.operationId === "querySymbols") {
        return queryKey;
      }

      if (
        operation.operationId === "equityPriceQuote" &&
        widgetRef?.current?.widgetId?.includes("news")
      ) {
        return ["news", ...queryKey];
      }

      return [id, ...queryKey, refreshQuery ?? 0] as unknown[];
    },
    [id, refreshQuery],
  );

  useLayoutEffect(() => {
    if ((widgetRef?.current?.widgetId || _queryOptions) === undefined) return;
    const staleTime = widgetRef?.current?.staleTime || 0;
    const queryStaleTime = _queryOptions?.staleTime || 0;

    if (typeof queryStaleTime === "number" && staleTime >= queryStaleTime) {
      setTimeout(() =>
        updateWidget((prev) => ({
          ...prev,
          staleTime: Math.min(
            prev.staleTime || Number.MAX_SAFE_INTEGER,
            queryStaleTime,
          ),
        })),
      );
    }
  }, [widgetRef]);

  return {
    fetcherOptions: {},
    queryOptions: {},
    queryKeyFn: queryKeyFnCallback,
  };
}

export const queryKeyFn = (operation: QueryOperation) => {
  const queryKey: unknown[] = hasPathParams(operation)
    ? operation.path
        .split("/")
        .filter(Boolean)
        .map((i) => resolvePathParam(i, operation.variables.pathParams))
    : operation.path.split("/").filter(Boolean);

  if (hasQueryParams(operation)) {
    queryKey.push(operation.variables.queryParams);
  }

  if (hasBody(operation)) {
    queryKey.push(operation.variables.body);
  }

  return queryKey;
};
// Helpers
const resolvePathParam = (key: string, pathParams: Record<string, string>) => {
  if (key.startsWith("{") && key.endsWith("}")) {
    return pathParams[key.slice(1, -1)];
  }
  return key;
};

const hasPathParams = (
  operation: QueryOperation,
): operation is QueryOperation & {
  variables: { pathParams: Record<string, string> };
} => {
  return Boolean((operation.variables as any).pathParams);
};

const hasBody = (
  operation: QueryOperation,
): operation is QueryOperation & {
  variables: { body: Record<string, unknown> };
} => {
  return Boolean((operation.variables as any).body);
};

const hasQueryParams = (
  operation: QueryOperation,
): operation is QueryOperation & {
  variables: { queryParams: Record<string, unknown> };
} => {
  return Boolean(operation.variables.queryParams);
};
