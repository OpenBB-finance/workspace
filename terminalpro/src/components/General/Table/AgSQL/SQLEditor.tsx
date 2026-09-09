import { useCallback, useMemo } from "react";
import { Label } from "~/components/ds/atoms/Label";
import FieldError from "~/components/Forms/FieldError";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useDataConnectorStore } from "~/lib/state/dataConnector";
import { SQLTextArea } from "../SubMenus/SQLTextArea";

type SQLEditorProps = {
  sqlValue: string;
  setSqlValue: (e: string, removedParams?: string[]) => void;
  errorMessage: string | null;
  dialogParams: { [key: string]: string };
  setDialogParams: (e: { [key: string]: string }) => void;
};

export function SQLEditor(props: SQLEditorProps) {
  const { sqlValue, setSqlValue, errorMessage, dialogParams, setDialogParams } = props;

  const { dataConnectorUrl } = useDataConnectorStore.getState();

  function getErrorMessage() {
    if (!dataConnectorUrl) return "Data Connector URL is not set";
    if (errorMessage === "valid") return null;
    return errorMessage;
  }

  const addParameter = useCallback(() => {
    const lastParamKey =
      Object.keys(dialogParams).reduce((acc, key) => {
        const keyNum = Number.parseInt(key.replace(/\D/g, ""), 10);
        return keyNum > acc ? keyNum : acc;
      }, 0) + 1;

    setDialogParams({
      ...dialogParams,
      [`${lastParamKey}`]: "",
    });
  }, [dialogParams]);

  const removeParameter = useCallback(
    (paramName: string) => {
      const newParams = { ...dialogParams };
      delete newParams[paramName];
      setDialogParams(newParams);
    },
    [dialogParams],
  );

  const filteredParams = useMemo(
    () => Object.entries(dialogParams).filter(([_key, value]) => value !== null),
    [dialogParams],
  );

  return (
    <>
      <div className="flex justify-between">
        <Label>Dynamic Parameters</Label>
        <Tooltip message="Add new parameter">
          <button
            onClick={addParameter}
            disabled={Object.values(dialogParams).some((value) => value === "")}
            tabIndex={-1}
          >
            <Icon
              id="plus-icon"
              className={`h-4 w-4 ${
                Object.values(dialogParams).some((value) => value === "")
                  ? "dark:text-light-600 text-light-300"
                  : "dark:hover:text-white dark:text-light-300 hover:text-black text-light-600"
              }`}
            />
          </button>
        </Tooltip>
      </div>
      <div className="flex flex-col gap-2">
        {filteredParams.length === 0 ? (
          <p>No parameters have been set</p>
        ) : (
          filteredParams.map(([paramName, paramValue]) => (
            <div key={paramName} className="flex items-center justify-between">
              <span className="mr-4">{`[${paramName}]`}</span>
              <input
                type="text"
                className="obb-minimal-input-search h-[34px]! w-full"
                placeholder={"Enter parameter"}
                value={paramValue}
                onChange={(e) =>
                  setDialogParams({
                    ...dialogParams,
                    [paramName]: e.target.value,
                  })
                }
              />
              <button onClick={() => removeParameter(paramName)}>
                <Icon
                  id="trash-icon"
                  className="h-3 w-3 ml-4 dark:hover:text-white dark:text-light-300 hover:text-black text-light-600"
                />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="mt-1" />
      <SQLTextArea
        value={sqlValue}
        onChange={setSqlValue}
        error={errorMessage && errorMessage !== "valid"}
        className="mt-2"
        size="medium"
        SQLTempParams={dialogParams}
      />
      <FieldError error={getErrorMessage()} id="sql-error" className="mb-2" />
    </>
  );
}
