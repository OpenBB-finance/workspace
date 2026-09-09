import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DataConnectorContext, type DcTabT } from "./DataConnectorContext";

export function DataConnectorProvider({
  children,
  onWidgetAdded,
}: {
  children: ReactNode;
  onWidgetAdded?: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const dashBoardId = useParams()?.id;

  const inDashboard = useMemo(() => !!dashBoardId, [dashBoardId]);
  const navigate = useNavigate();
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const setOpen = useCallback(
    (
      value: boolean,
      options?: {
        dcTab: DcTabT;
        mode: "create" | "edit";
        id?: string;
        widgetId?: string;
      },
    ) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        if (value) {
          newParams.set("modal", "data-connectors");
          if (options) {
            newParams.set("dcTab", options.dcTab);
            newParams.set("mode", options.mode);
            if (options.id) {
              newParams.set("id", options.id);
            }
            if (options.widgetId) {
              newParams.set("widgetId", options.widgetId);
            }
          } else {
            newParams.delete("dcTab");
            newParams.delete("mode");
            newParams.delete("id");
            newParams.delete("widgetId");
          }
        } else {
          newParams.delete("modal");
          newParams.delete("dcTab");
          newParams.delete("mode");
          newParams.delete("id");
          newParams.delete("widgetId");
        }
        return newParams;
      });
    },
    [setSearchParams],
  );

  const setTab = useCallback(
    (dcTab: DcTabT) => {
      setSearchParams((prev) => {
        const newParams = new URLSearchParams(prev);
        newParams.set("dcTab", dcTab);
        return newParams;
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (pendingNavigation) {
      setTimeout(() => navigate(pendingNavigation));
      setPendingNavigation(null);
    }
  }, [pendingNavigation, navigate]);

  const valueMemo = useMemo(
    () => ({
      open: searchParams.get("modal") === "data-connectors",
      mode: (searchParams.get("mode") as "create" | "edit") || "create",
      dcTab: (searchParams.get("dcTab") as DcTabT) || "file",
      id: searchParams.get("id") || "",
      widgetId: searchParams.get("widgetId") || "",
      setOpen,
      setTab,
      pendingNavigate: setPendingNavigation,
      inDashboard,
      onWidgetAdded,
    }),
    [
      searchParams.get("modal") === "data-connectors",
      searchParams.get("mode"),
      searchParams.get("dcTab"),
      searchParams.get("id"),
      searchParams.get("widgetId"),
      inDashboard,
      onWidgetAdded,
    ],
  );

  const childrenMemo = useMemo(() => children, [children]);

  return (
    <DataConnectorContext.Provider value={valueMemo}>
      {childrenMemo}
    </DataConnectorContext.Provider>
  );
}

DataConnectorProvider.displayName = "DataConnectorProvider";
