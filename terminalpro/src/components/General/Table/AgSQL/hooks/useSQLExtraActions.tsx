import isEqual from "lodash.isequal";
import { type Dispatch, useMemo } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { useWidgetContext } from "~/components/Widget.context";
import type { DispatchAction } from "~/hooks/useStateReducer";
import { getNewQuery, getReset } from "../utils";
import { paramsErrorMessage } from "./useAgSQLSettings";
import type { AgSQLState } from "./useAgSQLState";

export function useSQLExtraActions(
  handleSaveClick: () => void,
  state: AgSQLState,
  dispatch: Dispatch<DispatchAction<AgSQLState>>,
) {
  const { editSQL, loadingSave, loadingSaveAs, sqlValue, dialogParams } = state;
  const { widget } = useWidgetContext();
  const isError =
    !!state.errorMessage && state.errorMessage?.includes(paramsErrorMessage);

  const disableSave = useMemo(() => {
    if (!isEqual(widget?.storage?.SQLparams, dialogParams)) return false;

    const currentQuery = getNewQuery(widget.description, widget.storage?.SQLparams);
    const newQuery = getNewQuery(sqlValue, dialogParams);

    return isEqual(currentQuery, newQuery);
  }, [sqlValue, dialogParams, widget.description, widget.storage?.SQLparams]);

  const ExtraActions = useMemo(() => {
    if (!editSQL) return null;
    return (
      <>
        <Button
          variant="outlined"
          size="sm"
          onClick={() => dispatch(getReset(widget.description ?? ""))}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={loadingSaveAs || loadingSave || isError || disableSave}
          loading={loadingSave}
          onClick={async () => handleSaveClick()}
        >
          Save
        </Button>
        <Button
          loading={loadingSaveAs}
          disabled={loadingSave || loadingSaveAs || isError}
          size="sm"
          onClick={() => dispatch({ namePopup: true })}
        >
          Save as new widget
        </Button>
      </>
    );
  }, [
    editSQL,
    isError,
    loadingSave,
    loadingSaveAs,
    handleSaveClick,
    dispatch,
    widget.description,
    disableSave,
  ]);

  return ExtraActions;
}
