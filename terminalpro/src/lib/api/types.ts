import type * as reactQuery from "@tanstack/react-query";
import type * as Components from "./sdkComponents";

type ComponentsT = typeof Components;

export type OperationIdT = Components.QueryOperation["operationId"];

export type OperationT = {
  [K in OperationIdT]: Extract<Components.QueryOperation, { operationId: K }>;
};

export type VariablesT = {
  [K in OperationIdT]: OperationT[K]["variables"];
};

export type UseQueriesT<TQueryData, TError, TData = TQueryData> = Omit<
  reactQuery.UseQueryOptions<TQueryData, TError, TData>,
  "queryKey" | "queryFn" | "initialData"
>;

export type FetcherFn = ComponentsT[{
  [K in keyof ComponentsT]: K extends `fetch${string}` ? K : never;
}[keyof ComponentsT]];
