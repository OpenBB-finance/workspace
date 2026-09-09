import { useCallback } from "react";
import {
  addDatabaseSaveAs,
  type DBType,
  updateDatabaseQuery,
} from "~/api/dataConnectors";
import type { TSaveAs } from "~/components/DataConnectors/NamePopup";
import { useWidgetContext } from "~/components/Widget.context";
import { useShallowDataConnectorStore } from "~/lib/state/dataConnector";

type UpdateSQLDataProps = {
  sqlValue: string;
  setErrorMessage: (errorMessage: string | null) => void;
};

export function useUpdateSQLData() {
  const widget = useWidgetContext()?.widget;

  const { setDatabases, dataConnectorUrl } = useShallowDataConnectorStore(
    (authState) => ({
      setDatabases: authState.setDatabases,
      dataConnectorUrl: authState.dataConnectorUrl,
    }),
  );

  const updateSQLData = useCallback(
    async (props: UpdateSQLDataProps, values?: TSaveAs): Promise<null | number> => {
      const dbType = widget.connectionType as DBType;

      const { sqlValue, setErrorMessage } = props;
      if (!dataConnectorUrl) {
        setErrorMessage("Data Connector URL is not set");
        return null;
      }

      const dbId = Number(widget.widgetId.split("-")[1]);
      const response = values
        ? await addDatabaseSaveAs(dbType, dbId, values, sqlValue)
        : await updateDatabaseQuery(dbType, dbId, sqlValue);

      if (Array.isArray(response)) {
        setDatabases(dbType, response);
        setErrorMessage(null);
        if (values) {
          const ids = response.map((r) => r.id);
          return Math.max(...ids);
        }
        return dbId;
      }
      setErrorMessage(response?.detail ?? "Unexpected error occurred");
      return null;
    },
    [widget, dataConnectorUrl, setDatabases],
  );

  return updateSQLData;
}
