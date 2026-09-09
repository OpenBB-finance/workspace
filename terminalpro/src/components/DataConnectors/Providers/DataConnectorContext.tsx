import { createContext, useContext, useMemo } from "react";

// biome-ignore format: off
export type DcTabT = "single" | "backend" | "database" | "snowflake" | "file"| "website" | "rss" | "copilot_table" | "youtube";

type DataConnectorContextType = {
  inDashboard: boolean;
  open: boolean;
  pendingNavigate: (path: string) => void;
  dcTab: DcTabT;
  setTab: (dcTab: DcTabT) => void;
  mode: "create" | "edit" | "add-widget";
  id?: string;
  widgetId?: string;
  setOpen: (
    open: boolean,
    options?: {
      dcTab: DcTabT;
      mode: "create" | "edit" | "add-widget";
      id?: string;
      widgetId?: string;
    },
  ) => void;
  onWidgetAdded?: () => void;
};

export const DataConnectorContext = createContext<DataConnectorContextType | undefined>(
  undefined,
);

DataConnectorContext.displayName = "DataConnectorContext";

export function useDataConnectorContext() {
  const context = useContext(DataConnectorContext);
  const contextMemo = useMemo(() => context, [context]);
  if (!context) {
    throw new Error(
      "useDataConnectorContext must be used within a DataConnectorProvider",
    );
  }
  return contextMemo;
}
