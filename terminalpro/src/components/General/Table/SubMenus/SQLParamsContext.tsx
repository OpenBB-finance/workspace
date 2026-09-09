import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash.isequal";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn, useStoreWithEqualityFn } from "zustand/traditional";
import type { SqlParamDef, SqlParamDefT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";

interface SQLParamsType {
  activeTab?: number;
  sqlParamDefs: SqlParamDef[];
  originalSqlParamDefs?: SqlParamDef[];
  removedParamNames?: string[];
  paramIds: string[];
}
interface SQLParamsState extends SQLParamsType {
  setActiveTab: (index: number) => void;
  /**
   * This function ensures that when multiSelect is toggled,
   * the value is transformed accordingly to prevent type issues in the widget storage
   */
  processMultiSelectChange: <T = Record<string, any>>(storageParams?: T) => T;
  getTotalParams: () => number;
  getParamByIndex: (index: number) => SqlParamDef | undefined;
  getSqlParams: (endpointUrl?: string) => SqlParamDef[];
  addParameter: () => void;
  removeParameter: (index: number) => void;
  updateParameter: <T extends SqlParamDef["type"] = SqlParamDef["type"]>(
    index: number,
    field: keyof SqlParamDefT<T>,
    value: SqlParamDefT<T>[keyof SqlParamDefT<T>] | string,
  ) => void;
  resetParameters: () => void;
  onSaved: () => void;
  getRemovedParamNames: () => string[] | undefined;
  hasChanges: () => boolean;
  isUnique: (paramName: string, index: number) => boolean;
}

const createSQLParamsStore = (
  sqlParamDefs: SqlParamDef[] = [],
  seedNames: string[] = [],
) => {
  const definedNames = new Set(sqlParamDefs.map((p) => p.paramName));
  const seeded: SqlParamDef[] = seedNames
    .filter((name) => name && !definedNames.has(name))
    .map((name) => ({
      paramName: name,
      description: "",
      type: "text",
      value: "",
    }));
  const initialDefs = [...sqlParamDefs, ...seeded];
  const initialActiveTab = seeded.length > 0 ? sqlParamDefs.length : 0;
  const initialParamIds = initialDefs.map(() => uuidv4());

  return createWithEqualityFn<SQLParamsState>()(
    subscribeWithSelector((set, get) => ({
      activeTab: initialActiveTab,
      sqlParamDefs: initialDefs,
      originalSqlParamDefs: cloneDeep(sqlParamDefs),
      removedParamNames: [],
      paramIds: initialParamIds,
      setActiveTab: (index) => set({ activeTab: index }),
      processMultiSelectChange: (storageParams) => {
        const { sqlParamDefs, originalSqlParamDefs } = get();
        const prevParams = Object.fromEntries(
          originalSqlParamDefs.map((param) => [param.paramName, param]),
        );

        for (const param of sqlParamDefs) {
          const prevParam = prevParams[param.paramName];
          const value = storageParams?.[param.paramName];
          if (!(prevParam && value)) continue;

          if (prevParam?.multiSelect && !param.multiSelect) {
            // If multiSelect was disabled, take the first value if it's an array
            storageParams[param.paramName] = Array.isArray(value) ? value?.[0] : value;
          } else if (!prevParam?.multiSelect && param.multiSelect) {
            // If multiSelect was enabled, ensure the value is an array
            storageParams[param.paramName] = Array.isArray(value) ? value : [value];
          }
        }

        return storageParams;
      },
      getTotalParams: () => get().sqlParamDefs.length,
      getParamByIndex: (index) => get().sqlParamDefs[index],
      getRemovedParamNames: () => get().removedParamNames,
      getSqlParams: (endpointUrl?: string) =>
        get().sqlParamDefs.map((param) => {
          if (param.type === "endpoint" && endpointUrl) {
            return {
              ...param,
              optionsEndpoint: endpointUrl,
              // Generates a consistent groupById based on the query
              groupById: btoa(param.query.trim()),
            } as SqlParamDef;
          }
          return param;
        }),
      addParameter: () => {
        const newParam: SqlParamDef = {
          paramName: "",
          description: "",
          type: "text",
          value: "",
        };
        set((state) => {
          return {
            sqlParamDefs: [...state.sqlParamDefs, newParam],
            paramIds: [...state.paramIds, uuidv4()],
            activeTab: state.sqlParamDefs.length,
          };
        });
      },
      removeParameter: (index) => {
        set((state) => {
          const removedParam = state.sqlParamDefs[index]?.paramName;
          const sqlParamDefs = state.sqlParamDefs.filter((_, i) => i !== index);
          const paramIds = state.paramIds.filter((_, i) => i !== index);
          const update = { sqlParamDefs, paramIds } as SQLParamsType;

          if (state.activeTab >= index) {
            update.activeTab = Math.max(
              0,
              Math.min(state.activeTab, sqlParamDefs.length - 1),
            );
          }

          if (removedParam) {
            update.removedParamNames = [
              ...(state.removedParamNames || []),
              removedParam,
            ];
          }

          return update;
        });
      },
      updateParameter: (index, field, value) => {
        set((state) => {
          const updatedParams = [...state.sqlParamDefs];
          updatedParams[index] = {
            ...updatedParams[index],
            [field]: value,
          };
          return { sqlParamDefs: updatedParams };
        });
      },
      resetParameters: () => {
        set((state) => ({
          activeTab: 0,
          sqlParamDefs: state.originalSqlParamDefs || [],
          removedParamNames: [],
        }));
      },
      onSaved: () =>
        set(() => ({
          activeTab: 0,
          originalSqlParamDefs: get().sqlParamDefs,
          removedParamNames: [],
        })),
      hasChanges: () => {
        const { sqlParamDefs, originalSqlParamDefs, isUnique } = get();
        const hasChanges = !isEqual(sqlParamDefs, originalSqlParamDefs);

        const validParams = sqlParamDefs.every(
          (param, index) =>
            isUnique(param.paramName, index) && param.paramName.trim().length > 1,
        );
        return hasChanges && validParams;
      },
      isUnique: (paramName, index) => {
        const paramDefs = get().sqlParamDefs;
        return !paramDefs.find((p, i) => p.paramName === paramName && i !== index);
      },
    })),
    shallow,
  );
};

export type SQLParamsStore = ReturnType<typeof createSQLParamsStore>;

const SQLParamsContext = createContext<SQLParamsStore | null>(null);

export function useSQLParamsStore(): SQLParamsStore {
  const store = useContext(SQLParamsContext);

  if (!store) {
    throw new Error("useSQLParamsStore must be used within a SQLParamsProvider");
  }

  return store;
}

export function useSQLParamsContext<T = SQLParamsState>(
  selector: (store: SQLParamsState) => T = (store) => store as unknown as T,
  equalityFn: (a: T, b: T) => boolean = (prev, next) => isEqual(prev, next),
) {
  const store = useContext(SQLParamsContext);

  if (!store) {
    throw new Error("useSQLParamsContext must be used within a SQLParamsProvider");
  }

  return useStoreWithEqualityFn(store, useShallow(selector), equalityFn);
}

export function SQLParamsProvider({
  children,
  seedNames,
}: {
  children: ReactNode;
  seedNames?: string[];
}): ReactElement {
  const storeRef = useRef<SQLParamsStore>();
  const sqlParamDefs = useWidgetContext(true)?.widget?.storage?.sqlParamDefs;
  if (!storeRef.current) {
    storeRef.current = createSQLParamsStore(sqlParamDefs, seedNames);
  }

  const childrenMemo = useMemo(() => children, [children]);

  return (
    <SQLParamsContext.Provider value={storeRef.current}>
      {childrenMemo}
    </SQLParamsContext.Provider>
  );
}
