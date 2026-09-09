import type { ColDef } from "ag-grid-community";
import type { AgGridReact } from "ag-grid-react";
import isEqual from "lodash.isequal";

import { type Dispatch, useCallback, useEffect } from "react";
import type { DBType } from "~/api/dataConnectors";
import type { TSaveAs } from "~/components/DataConnectors/NamePopup";
import { useWidgetContext } from "~/components/Widget.context";
import { type DispatchAction, useStateReducer } from "~/hooks/useStateReducer";
import { useShallowAppStore } from "~/lib/state/app";
import { query } from "~/utils/zodForms";
import { ensureAgGrid, useAgGridContext } from "../../hooks";
import { getNewQuery, getReset } from "../utils";
import { useNewEndpoint } from "./useNewEndpoint";
import { useUpdateSQLData } from "./useUpdateSQLData";

export type AgSQLState = {
  editSQL: boolean;
  openSettings: boolean;
  errorMessage: string | null;
  sqlValue: string;
  decimalDigitsSettings: number;
  namePopup: boolean;
  loadingSave: boolean;
  loadingSaveAs: boolean;
  dialogParams: { [key: string]: string };
  rowData: any[];
  columnDefs: ColDef[];
};

const initialState: AgSQLState = {
  editSQL: false,
  openSettings: false,
  errorMessage: null,
  namePopup: false,
  loadingSave: false,
  loadingSaveAs: false,
  sqlValue: "",
  decimalDigitsSettings: 2,
  dialogParams: {},
  rowData: [],
  columnDefs: [],
};

function setLoading(agGrid: AgGridReact, loading: boolean, saveAs = false) {
  if (!saveAs && ensureAgGrid(agGrid)) {
    agGrid?.api?.updateGridOptions({ loading, columnDefs: [] });
  }
}

export function useAgSQLState(decimalDigits: number) {
  const { widget, activeDashboardId, updateWidget } = useWidgetContext();

  const [state, dispatch] = useStateReducer({
    ...initialState,
    sqlValue: widget.description ?? "",
    decimalDigitsSettings: widget.storage?.decimalDigits ?? decimalDigits,
    dialogParams: (widget?.storage?.SQLparams ?? {}) as { [key: string]: string },
  });
  const addWidget = useShallowAppStore((appState) => appState.addWidget);
  const newEndpoint = useNewEndpoint();
  const gridRef = useAgGridContext()?.gridRef;

  const updateSQLData = useUpdateSQLData();

  const handleSave = useCallback(
    async (values?: TSaveAs): Promise<boolean> => {
      let response: null | number = null;
      try {
        const oldQuery = getNewQuery(widget.description, widget?.storage?.SQLparams);
        const newQuery = getNewQuery(state.sqlValue, state.dialogParams);

        const queryResult = query.safeParse(newQuery) as unknown as {
          error: { issues: { message: string }[] };
          success: boolean;
        };
        if (!queryResult.success) {
          const issue = queryResult.error.issues[0];
          dispatch({ errorMessage: issue.message });
          return false;
        }

        if (
          isEqual(oldQuery, newQuery) &&
          !values &&
          isEqual(widget?.storage?.SQLparams, state.dialogParams)
        ) {
          dispatch({ errorMessage: null });
          return true;
        }

        setLoading(gridRef.current, true, !!values);

        response = await updateSQLData(
          {
            sqlValue: newQuery,
            setErrorMessage: (errorMessage) => {
              dispatch({ errorMessage });
            },
          },
          values,
        ).catch(() => null);

        if (!response) return false;

        // Apply the changes from the local state to the actual grid
        if (values) {
          const endpointHeaders = Object.entries(
            newEndpoint(widget.endpoint.url, response).headers,
          ).map(([key, value]) => ({ key, value }));

          const dbType = widget.connectionType as DBType;

          addWidget(activeDashboardId, {
            ...widget,
            id: undefined,
            // Only update the endpoint if the SQL is valid
            widgetId: `${dbType}-${response}` as const,
            description: state.sqlValue,
            name: values.name,
            endpoint: {
              url: newEndpoint(widget.endpoint.url, response).url,
              method: "POST",
            },
            endpointHeaders: endpointHeaders,
            storage: {
              ...widget.storage,
              SQLparams: state.dialogParams,
            },
          });
          dispatch(getReset(widget.description ?? ""));

          return true;
        }

        updateWidget((prev) => ({
          ...prev,
          description: state.sqlValue,
          storage: {
            ...prev.storage,
            SQLparams: state.dialogParams,
          },
        }));

        setLoading(gridRef.current, false, !!values);
        gridRef?.current?.api?.refreshServerSide({ purge: true });

        return true;
      } finally {
        setLoading(gridRef.current, false, !!values);
      }
    },
    [
      widget,
      state.sqlValue,
      dispatch,
      activeDashboardId,
      state.dialogParams,
      updateSQLData,
    ],
  );

  useEffect(() => {
    dispatch({ dialogParams: widget?.storage?.SQLparams ?? {} });
  }, [state.editSQL]);

  return [state, dispatch, handleSave] as [
    AgSQLState,
    Dispatch<DispatchAction<AgSQLState>>,
    typeof handleSave,
  ];
}
