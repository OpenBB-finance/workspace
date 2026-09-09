import isEqual from "lodash.isequal";
import semver from "semver";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import type { DatabaseT, DBType } from "~/api/dataConnectors";
import type { Selector } from "./app";

export type Database = {
  query: string;
  id: number;
  connection: number;
  name: string;
  database: string;
  database_type: string;
  category: string;
  subCategory: string;
  description: string;
};

export type SnowflakeDatabase = Database & {
  role: string;
  warehouse: string;
  database: string;
  database_schema: string;
};

interface DataConnectorStore {
  databases: Database[];
  setDatabases: <T extends DBType>(type: T, databases: DatabaseT<T>[]) => void;
  getDatabases: <T extends DBType>(type: T) => DataConnectorStore[`${T}s`];
  snowflakes: SnowflakeDatabase[];
  dataConnectorUrl?: URL;
  setDataConnectorUrl: (value: undefined | URL) => void;
  dataConnectorVersion?: string;
  setDataConnectorVersion: (value: undefined | string) => void;
  validVersion: () => boolean;
  getDataBaseDetails: <T extends DBType>(
    type: T,
    id: number,
  ) => DatabaseT<T> | undefined;
}

// This is for data connectors that sync with the pro dataconnector binary
export const useDataConnectorStore = createWithEqualityFn<DataConnectorStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        databases: [],
        snowflakes: [],
        setDatabases: <T extends DBType>(type: T, databases: DatabaseT<T>[]) => {
          set({
            [`${type}s`]: (databases ?? [])?.map((db) => {
              return Object.fromEntries(
                Object.entries(db).map(([key, value]) => {
                  if (key === "subCategory") return [key, value];

                  // convert any camelCase keys to snake_case
                  return [
                    key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
                    value,
                  ];
                }),
              );
            }),
          });
        },
        getDatabases: (type) => get()[`${type}s`],
        dataConnectorUrl: undefined,
        setDataConnectorUrl: (value: undefined | URL) =>
          set({ dataConnectorUrl: value }),
        dataConnectorVersion: undefined,
        setDataConnectorVersion: (value: undefined | string) =>
          set({ dataConnectorVersion: value }),
        validVersion: () => {
          const minVersion = import.meta.env.VITE_DATA_CONNECTOR_MIN_VERSION;
          const { dataConnectorVersion } = get();
          if (dataConnectorVersion === undefined || minVersion === undefined) {
            return true;
          }
          return semver.gte(dataConnectorVersion, minVersion);
        },
        getDataBaseDetails: <T extends DBType>(type: T, id: number) => {
          const databases = get().getDatabases(type);
          return databases?.find((db) => db.id === id) as DatabaseT<T> | undefined;
        },
      }),
      {
        name: "data-connector-storage",
        version: 1,
      },
    ),
  ),
  shallow,
);

export function useShallowDataConnectorStore<S extends DataConnectorStore, T>(
  selector: Selector<S, T>,
): T {
  return useDataConnectorStore(useShallow(selector), (prev, next) =>
    isEqual(prev, next),
  );
}
