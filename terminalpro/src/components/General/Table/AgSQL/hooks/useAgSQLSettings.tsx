import { type Dispatch, useCallback, useMemo } from "react";
import { useWidgetContext } from "~/components/Widget.context";
import type { DispatchAction } from "~/hooks/useStateReducer";
import TableSettings from "../../SubMenus/TableSettings";
import { SQLEditor } from "../SQLEditor";
import { getReset } from "../utils";
import type { AgSQLState } from "./useAgSQLState";

export const paramsErrorMessage = "Please replace the following parameters:";

export function useAgSQLSettings(props: {
  editSQL: boolean;
  sqlValue: string;
  errorMessage: string | null;
  decimalDigitsSettings: number;
  namePopup: boolean;
  dialogParams: { [key: string]: string };
  dispatch: Dispatch<DispatchAction<AgSQLState>>;
  handleSaveColumnVisibility: () => void;
}) {
  const {
    dispatch,
    handleSaveColumnVisibility,
    editSQL,
    sqlValue,
    errorMessage,
    decimalDigitsSettings,
    namePopup,
    dialogParams,
  } = props;
  const widget = useWidgetContext()?.widget;

  const setOpenSettings = useCallback(
    (e: boolean) => {
      if (editSQL && !namePopup) {
        dispatch({ openSettings: e, editSQL: false });
      }
      if (!(editSQL || e)) {
        dispatch(getReset(widget.description ?? ""));
      }
    },
    [editSQL, widget.description, namePopup, dispatch],
  );

  const onSaveSettings = useCallback(() => {
    if (!editSQL) {
      handleSaveColumnVisibility();
    }
    // Intentionally left blank to mimic 'undefined' behavior when editSQL is true
  }, [editSQL, handleSaveColumnVisibility]);

  const settingsDialogClassname = useMemo(() => {
    return editSQL ? "h-fit" : "";
  }, [editSQL]);

  const settingsModalChildren = useMemo(() => {
    if (editSQL) {
      return (
        <SQLEditor
          sqlValue={sqlValue}
          setSqlValue={(sqlValue, removedParams) => {
            const newMessage = removedParams
              ? `${paramsErrorMessage} ${removedParams.join(", ")}`
              : null;

            dispatch({
              sqlValue,
              errorMessage: (prev) =>
                newMessage ?? (prev?.includes(paramsErrorMessage) ? null : prev),
            });
          }}
          errorMessage={errorMessage}
          dialogParams={dialogParams}
          setDialogParams={(dialogParams) => dispatch({ dialogParams })}
        />
      );
    }
    return (
      <TableSettings
        decimalDigitsSettings={decimalDigitsSettings}
        setDecimalDigitsSettings={(decimalDigitsSettings) =>
          dispatch({ decimalDigitsSettings })
        }
      />
    );
  }, [editSQL, sqlValue, errorMessage, decimalDigitsSettings, dispatch, dialogParams]);

  return {
    setOpenSettings,
    onSaveSettings,
    settingsDialogClassname,
    settingsModalChildren,
  };
}
