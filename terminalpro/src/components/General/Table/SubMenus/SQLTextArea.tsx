import { useCodeMirror } from "@uiw/react-codemirror";
import clsx from "clsx";
import { forwardRef, useLayoutEffect, useRef } from "react";
import { Label } from "~/components/ds/atoms/Label";
import { FormMessage } from "~/components/ds/molecules/Form";
import InfoIcon from "~/components/Icons/Info";
import Tooltip from "~/components/Tooltip";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useShallowThemeStore } from "~/lib/state/theme";
import { editorThemes } from "./themes";
import { getExtensions, getSQLPlugins } from "./utils";

interface Props {
  name?: string;
  value: string;
  onChange: (value: string, removedParams?: string[]) => void;
  error?: boolean;
  className?: string;
  disabled?: boolean;
  size?: "small" | "medium";
  SQLTempParams?: Record<string, string>;
}

function getParamKeys(params: Record<string, string>) {
  return Object.keys(params).filter((key) => params[key] !== "");
}

export const FormSQLTextArea = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { name, value, onChange, error, className, disabled, size } = props;

  return (
    <div className={className} ref={ref}>
      <SQLTextArea
        name={name}
        value={value}
        onChange={onChange}
        error={error}
        disabled={disabled}
        size={size}
      />
      <FormMessage />
    </div>
  );
});

export const SQLTextArea = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const {
    value,
    onChange,
    error,
    className,
    disabled,
    size = "small",
    SQLTempParams,
  } = props;

  const sizeCss = {
    "h-[180px]": size === "small",
    "min-h-[180px] max-h-[300px] h-[180px]": size === "medium",
  };
  const sharedSize = clsx("p-2 w-full border-2 rounded-md", sizeCss);
  const displayRef = useRef<HTMLDivElement>(null);
  const theme = useShallowThemeStore((state) => state.theme);
  const paramKeys = getParamKeys(SQLTempParams || {});

  const [state, dispatch] = useStateReducer({
    paramKeys: paramKeys,
    paramsExt: getSQLPlugins(paramKeys, []),
    removedParams: [],
  });

  useLayoutEffect(() => {
    const params = getParamKeys(SQLTempParams || {});
    const removedParams = state.paramKeys.filter((param) => !params.includes(param));
    if (
      params.length !== state.paramKeys.length ||
      removedParams.length !== state.removedParams.length
    ) {
      dispatch({
        paramKeys: params,
        paramsExt: getSQLPlugins(params, removedParams),
        removedParams,
      });
    }
  }, [SQLTempParams]);

  useCodeMirror({
    value,
    extensions: getExtensions(state.paramsExt),
    theme: editorThemes[theme],
    onChange: (value, viewUpdate) => {
      const errors = viewUpdate?.view?.dom?.querySelectorAll(".cm-sqlparams-error");

      const hasError = errors?.length > 0;

      const removedParams = state.removedParams.map((param) => `[${param}]`);
      onChange(value, hasError ? removedParams : undefined);
    },
    onUpdate(viewUpdate) {
      const needsUpdate = state.removedParams.length > 0;
      const errors = viewUpdate?.view?.dom?.querySelectorAll(".cm-sqlparams-error");

      const hasError = errors?.length > 0;

      if (needsUpdate && hasError) {
        const removedParams = state.removedParams.map((param) => `[${param}]`);

        onChange(value, removedParams);

        return;
      }

      if (!hasError && error) {
        onChange(value);
      }
    },
    container: displayRef.current,
    width: "100%",
    height: "inherit",
    minHeight: "180px",
    maxHeight: "300px",
    editable: !disabled,
    basicSetup: {
      lineNumbers: false,
      foldGutter: false,
    },
  });

  return (
    <div className={className} ref={ref}>
      <div className="flex">
        <Label>SQL Query</Label>
        <Tooltip message="If dynamic parameters are set, these will be replaced from the SQL query before retrieving the data.">
          <div>
            <InfoIcon className="w-4 h-4 ml-2 dark:text-light-300 text-light-600" />
          </div>
        </Tooltip>
      </div>
      <div className="my-1" />
      <div
        className={clsx(
          "p-2 dark:bg-[#303038] border-2 rounded-md",
          "border-light-200 dark:border-transparent",
          {
            "error-border": error,
            sharedSize,
          },
        )}
        ref={(el) => (displayRef.current = el)}
      />
    </div>
  );
});

SQLTextArea.displayName = "SQLTextArea";
