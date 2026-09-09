import * as reactQuery from "@tanstack/react-query";
import * as Components from "./sdkComponents";
import { useSdkContext } from "./sdkContext";
import type {
  OBBjectEquityHistorical,
  OBBjectEquityQuote,
  OBBjectPricePerformance,
} from "./sdkSchemas";
import type {
  FetcherFn,
  OperationIdT,
  OperationT,
  UseQueriesT,
  VariablesT,
} from "./types";

function GetSplitArray(splitParam: string, variables: any, size: number): string[][] {
  const array = (variables?.queryParams?.[splitParam]?.split(",") ?? []) as string[];
  return array?.reduce((acc, value, i) => {
    if (i % size === 0) {
      acc.push([]);
    }
    acc[acc.length - 1].push(value);
    return acc;
  }, []);
}

export function useCreateQueries<OpId extends OperationIdT, TData, TError>(
  operation: OperationT[OpId],
  options?: UseQueriesT<TData, TError>,
  fetchFn?: FetcherFn,
  splitParam = "symbol",
  splitArraySize = 50,
): reactQuery.UseQueryResult<TData, TError>[] {
  const { fetcherOptions, queryOptions, queryKeyFn } = useSdkContext(options);

  const splitArray = GetSplitArray(splitParam, operation.variables, splitArraySize);

  const queries = splitArray.map((array) => {
    const newVariables = {
      ...operation.variables,
      queryParams: {
        ...operation.variables.queryParams,
        [splitParam]: array.join(","),
      },
    } as VariablesT[OpId];
    return {
      queryKey: queryKeyFn({
        path: operation.path,
        operationId: operation.operationId,
        variables: newVariables,
      } as OperationT[OpId]),
      // @ts-expect-error
      queryFn: ({ signal }) => fetchFn({ ...fetcherOptions, ...newVariables }, signal),
      ...options,
      ...queryOptions,
    } as reactQuery.UseQueryOptions<TData, TError, TData>;
  });

  return reactQuery.useQueries({ queries });
}

export const useQueriesEquityPriceQuote = <
  TData = OBBjectEquityQuote,
  TError = Components.EquityPriceQuoteError,
>(
  variables: VariablesT["equityPriceQuote"],
  options?: UseQueriesT<TData, TError>,
) => {
  return useCreateQueries<"equityPriceQuote", OBBjectEquityQuote, TError>(
    {
      path: "/api/v1/equity/price/quote",
      operationId: "equityPriceQuote",
      variables,
    },
    options,
    Components.fetchEquityPriceQuote,
  );
};

export const useQueriesEquityPriceHistorical = <
  TData = OBBjectEquityHistorical,
  TError = Components.EquityPriceHistoricalError,
>(
  variables: VariablesT["equityPriceHistorical"],
  options?: UseQueriesT<TData, TError>,
) => {
  return useCreateQueries<"equityPriceHistorical", OBBjectEquityHistorical, TError>(
    {
      path: "/api/v1/equity/price/historical",
      operationId: "equityPriceHistorical",
      variables,
    },
    options,
    Components.fetchEquityPriceHistorical,
  );
};

export const useQueriesEquityPricePerformance = <
  TData = OBBjectPricePerformance,
  TError = Components.EquityPriceHistoricalError,
>(
  variables: VariablesT["equityPricePerformance"],
  options?: UseQueriesT<TData, TError>,
) => {
  return useCreateQueries<"equityPricePerformance", OBBjectPricePerformance, TError>(
    {
      path: "/api/v1/equity/price/performance",
      operationId: "equityPricePerformance",
      variables,
    },
    options,
    Components.fetchEquityPricePerformance,
  );
};
