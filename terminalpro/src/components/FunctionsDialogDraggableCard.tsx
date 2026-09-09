import cloneDeep from "lodash/cloneDeep";
import { useMemo, useState } from "react";
import CodeSnippet from "~/components/CodeSnippet";
import type { Widget } from "~/lib/state/app";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { cn } from "~/lib/utils";
import { showNotification } from "~/lib/utils/toast";
import excelFunctions from "../lib/api/excelFunctions.json";
import { Button } from "./ds/atoms/Button";
import { Checkbox } from "./ds/atoms/Checkbox";
import { BaseDialog } from "./ds/dialogs/BaseDialog";
import { DialogDescription, DialogTitle } from "./ds/dialogs/Dialog";
import TerminalProOnlyTag from "./General/TerminalProOnlyTag";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import { useWidgetContext } from "./Widget.context";

function getPlatformLink(functionName: string) {
  //obb.equity.fundamental.management -> https://docs.openbb.co/platform/reference/equity/fundamental/management

  const parts = functionName.split(".");
  if (parts[0] !== "obb") {
    throw new Error("Invalid function name");
  }

  if (parts.length === 3) {
    const [, category, func] = parts;
    return `https://docs.openbb.co/platform/reference/${category.toLowerCase()}/${func.toLowerCase()}`;
  }
  if (parts.length === 4) {
    const [, category, subcategory, func] = parts;
    return `https://docs.openbb.co/platform/reference/${category.toLowerCase()}/${subcategory.toLowerCase()}/${func.toLowerCase()}`;
  }
  throw new Error("Invalid function name");
}

export function getFunc(
  functionName: string,
  widget: Widget,
  kind: "excel" | "platform",
) {
  const functionNameExcel = functionName
    .replace(kind === "excel" ? "OBB." : "obb.", "")
    .toUpperCase();

  const funcs = functionName;

  const storageParams = cloneDeep(widget.storage?.params || {});

  for (const p of widget?.params || []) {
    const paramValue = storageParams[p.paramName];
    if (
      p.type === "number" &&
      typeof paramValue === "string" &&
      !Number.isNaN(Number(paramValue))
    ) {
      storageParams[p.paramName] = Number(paramValue);
    }
  }

  // function to get all of the non optional parameters in the excelfunctions.json based on the name from the widget
  const getNonOptionalParameters = (functionName: string) => {
    const functionData = excelFunctions.functions.find(
      (func) => func.name === functionName,
    );
    if (!functionData) {
      throw new Error("Function not found in excelFunctions.json");
    }
    // ignoring provider for now
    const nonOptionalParameters = functionData.parameters.filter(
      (param) => param.name && param.name !== "provider",
    );
    return nonOptionalParameters as { name: string; type: string }[];
  };

  const formatParamValue = (value: any): string | number => {
    if (value === undefined || value === null || value === "") return "";
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (typeof value === "number") return value;
    return `"${value}"`;
  };

  const getSingleLineFormat = (params: string[]): string => {
    return `=${funcs}(${params.filter(Boolean).join(",")})`;
  };

  const getDisplayFormat = (params: string[]): string => {
    const filteredParams = params.filter(Boolean);
    if (filteredParams.length <= 2) {
      return getSingleLineFormat(filteredParams);
    }
    const [first, second, ...rest] = filteredParams;
    const restParams = rest[0]
      ?.slice(1, -1)
      .split(";")
      .map((p) => p.trim())
      .filter(Boolean)
      .join(";\n      ");
    return `=${funcs}(\n   ${first},\n   ${second},\n   {\n      ${restParams}\n   })`;
  };

  const getExplicitParamsFormat = (
    widget: Widget,
    params: Record<string, any>,
  ): { display: string; copy: string } => {
    // Filter out empty values and metadata objects
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([_, value]) => {
        // Skip if value is a metadata object (has value property)
        if (typeof value === "object" && value !== null && "value" in value) {
          return false;
        }
        const formattedValue = formatParamValue(value);
        return (
          formattedValue !== "" &&
          formattedValue !== '""' &&
          formattedValue !== '""' &&
          !(Array.isArray(value) && value.length === 0)
        );
      }),
    );

    // Find the longest parameter name for alignment
    const maxParamNameLength = Math.max(
      ...Object.keys(filteredParams).map((key) => key.length),
    );

    // Create parameter table with aligned values for both display and copy
    const paramTable = Object.entries(filteredParams)
      .map(([key, value]) => {
        const paddedKey = key.padEnd(maxParamNameLength);
        return `${paddedKey}\t${value}`;
      })
      .join("\n");

    // Calculate offset based on number of parameters
    const numParams = Object.keys(filteredParams).length;
    const tablePrefix = paramTable ? `${paramTable}\n\n` : "";

    // For BYOD with advanced-backend
    if (
      functionNameExcel === "WIDGET" &&
      widget.connectionType === "advanced-backend"
    ) {
      const rangeRef = `A1:B${numParams}`;
      const displayFormat = `${tablePrefix}=OBB.WIDGET(\n    "${widget.sourceName}",\n    "${widget.widgetId}",\n    ${rangeRef}\n)`;
      const copyFormat = `${tablePrefix}=OBB.WIDGET("${widget.sourceName}","${widget.widgetId}",${rangeRef})`;
      return { display: displayFormat, copy: copyFormat };
    }

    // For other functions, format with proper indentation for display
    const formattedParams = Object.entries(filteredParams)
      .map(([key, value]) => `    ${key}=${formatParamValue(value)}`)
      .join(",\n");

    // Create single line format for copy
    const singleLineParams = Object.entries(filteredParams)
      .map(([key, value]) => `${key}=${formatParamValue(value)}`)
      .join(",");

    const displayFormat = `${tablePrefix}=OBB.${functionNameExcel}(\n${formattedParams}\n)`;
    const copyFormat = `${tablePrefix}=OBB.${functionNameExcel}(${singleLineParams})`;

    return { display: displayFormat, copy: copyFormat };
  };

  try {
    // Single Widget
    if (
      kind === "excel" &&
      functionNameExcel === "WIDGET" &&
      widget.connectionType === "single"
    ) {
      const paramNamesExcelBYOD = widget.name ? [`"${widget.name}"`] : [];

      const { display, copy } = getExplicitParamsFormat(widget, storageParams);
      return {
        display: getDisplayFormat(paramNamesExcelBYOD.filter(Boolean)),
        copy: getSingleLineFormat(paramNamesExcelBYOD.filter(Boolean)),
        explicitParamsCopy: copy,
        explicitParamsDisplay: display,
      };
    }
    // Advanced Backend
    if (
      kind === "excel" &&
      functionNameExcel === "WIDGET" &&
      (widget.widgetId.split("-")[0] === "database" ||
        widget.widgetId.split("-")[0] === "snowflake")
    ) {
      const paramNamesExcelBYOD = [
        widget.name ? `"${widget.name}"` : null,
        widget.widgetId.split("-")[0] ? `"${widget.widgetId.split("-")[0]}"` : null,
      ].filter(Boolean);
      const { display, copy } = getExplicitParamsFormat(widget, storageParams);
      return {
        display: getDisplayFormat(paramNamesExcelBYOD),
        copy: getSingleLineFormat(paramNamesExcelBYOD),
        explicitParamsCopy: copy,
        explicitParamsDisplay: display,
      };
    }

    if (
      kind === "excel" &&
      functionNameExcel === "WIDGET" &&
      widget.connectionType === "advanced-backend"
    ) {
      const paramNamesExcelBYOD = [
        widget.sourceName ? `"${widget.sourceName}"` : null,
        widget.widgetId ? `"${widget.widgetId}"` : null,
      ].filter(Boolean);

      // Add all parameters including symbol and date, but only if they have non-empty values
      const allParams = Object.entries(storageParams)
        .filter(([key, value]) => {
          // Skip numeric keys and object values
          if (Number.isNaN(Number(key)) === false || typeof value === "object") {
            return false;
          }
          const formattedValue = formatParamValue(value);
          return formattedValue && formattedValue !== '""' && formattedValue !== '""';
        })
        .map(([key, value]) => {
          const formattedValue = formatParamValue(value);
          return `"${key}",${formattedValue}`;
        })
        .join(";");

      if (allParams) {
        paramNamesExcelBYOD.push(`{${allParams}}`);
      }

      const { display, copy } = getExplicitParamsFormat(widget, storageParams);
      return {
        display: getDisplayFormat(paramNamesExcelBYOD),
        copy: getSingleLineFormat(paramNamesExcelBYOD),
        explicitParamsCopy: copy,
        explicitParamsDisplay: display,
      };
    }

    const nonOptionalParams = getNonOptionalParameters(functionNameExcel);

    if (kind === "excel") {
      const paramNamesExcel = [];
      const explicitParams: Record<string, any> = {};
      for (const param of nonOptionalParams) {
        const value = storageParams?.[param.name];
        if (value !== undefined && value !== null && value !== "") {
          const paramValue = formatParamValue(value);
          if (paramValue) {
            paramNamesExcel.push(paramValue);
            explicitParams[param.name] = value;
          }
        }
      }
      const { display, copy } = getExplicitParamsFormat(widget, explicitParams);
      return {
        display: getDisplayFormat(paramNamesExcel.filter(Boolean)),
        copy: getSingleLineFormat(paramNamesExcel.filter(Boolean)),
        explicitParamsCopy: copy,
        explicitParamsDisplay: display,
      };
    }
    if (kind === "platform") {
      const paramNamesPlatform = [];
      for (const param of nonOptionalParams) {
        const value = storageParams?.[param.name];
        if (value !== undefined && value !== null && value !== "") {
          const formattedValue = formatParamValue(value);
          if (formattedValue) {
            paramNamesPlatform.push(`${param.name}=${formattedValue}`);
          }
        }
      }
      const platformFunc = `${funcs}(${paramNamesPlatform.join(",")})`;
      return {
        display: platformFunc,
        copy: platformFunc,
      };
    }
  } catch (error) {
    return {
      display: funcs,
      copy: funcs,
    };
  }
}

function getExcelLink(functionName: string) {
  //OBB.EQUITY.FUNDAMENTAL.MANAGEMENT -> https://docs.openbb.co/excel/reference/equity/fundamental/management

  const parts = functionName.split(".");

  if (parts[0] !== "OBB") {
    throw new Error("Invalid function name");
  }

  if (parts[1] === "WIDGET") {
    return "https://docs.openbb.co/excel/data-connectors";
  }
  if (parts.length === 3) {
    const [, category, func] = parts;
    return `https://docs.openbb.co/excel/reference/${category.toLowerCase()}/${func.toLowerCase()}`;
  }
  if (parts.length === 4) {
    const [, category, subcategory, func] = parts;
    return `https://docs.openbb.co/excel/reference/${category.toLowerCase()}/${subcategory.toLowerCase()}/${func.toLowerCase()}`;
  }
  throw new Error("Invalid function name");
}

export default function FunctionsDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const [useExplicitParams, setUseExplicitParams] = useState(false);
  const isProTier = useShallowFeatureFlagsStore(
    (state) => state.featureFlags?.tier === "pro",
  );
  const { widget, widgetFromJSON } = useWidgetContext();
  const excelDataFunction = widget.external
    ? ["OBB.WIDGET"]
    : widgetFromJSON?.excelDataFunction;

  const platformDataFunction = widgetFromJSON?.platformDataFunction;

  const memorizedExcelDataFunction = useMemo(() => {
    return excelDataFunction?.map((func, index) => {
      const { display, copy, explicitParamsCopy, explicitParamsDisplay } = getFunc(
        func,
        widget,
        "excel",
      );
      return (
        <div key={index} className="flex flex-col gap-4 mb-2">
          <div className="flex gap-2">
            <CodeSnippet
              disabled={!isProTier}
              text={useExplicitParams ? explicitParamsDisplay : display}
              className="grow w-32"
              hideCopy={true}
            />
          </div>
          {useExplicitParams && excelDataFunction?.[0] === "OBB.WIDGET" && (
            <div className="body-xs-regular flex items-start gap-2 text-ds-text-caption">
              <Icon id="warning-icon" className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Note that the range{" "}
                <strong className="text-ds-text-body">
                  A1:B
                  {
                    Object.keys(widget.storage?.params || {}).filter((key) => {
                      const value = widget.storage?.params?.[key];
                      return (
                        value !== undefined &&
                        value !== null &&
                        value !== "" &&
                        !(
                          typeof value === "object" &&
                          value !== null &&
                          "value" in value
                        )
                      );
                    }).length
                  }
                </strong>{" "}
                implies that you paste this into the first cell of your excel
                spreadsheet.
              </span>
            </div>
          )}
          <div className="flex items-center gap-4">
            <Button
              variant="primary"
              size="sm"
              disabled={!isProTier}
              onClick={() => {
                navigator.clipboard.writeText(
                  useExplicitParams ? explicitParamsCopy : copy,
                );
                showNotification({
                  message: "Excel formula successfully copied.",
                  description: (
                    <>
                      Note: The OpenBB Add-in for Excel is required to get updated data.
                      More information can be found in the{" "}
                      <a
                        href="https://docs.openbb.co/excel"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-link-color hover:opacity-80"
                      >
                        Excel add-in docs
                      </a>
                      .
                    </>
                  ),
                  toastType: "success",
                });
                setOpen(false);
              }}
            >
              Copy to clipboard
            </Button>
            <Checkbox
              checked={useExplicitParams}
              onCheckedChange={(checked) => setUseExplicitParams(checked === true)}
              disabled={!isProTier}
              label="with explicit parameters"
              labelClassName="whitespace-nowrap"
            />
          </div>
        </div>
      );
    });
  }, [excelDataFunction, widget, isProTier, useExplicitParams]);

  const memorizedPlatformDataFunction = useMemo(() => {
    return platformDataFunction?.map((func, index) => {
      const { display, copy } = getFunc(func, widget, "platform");
      return (
        <div key={index} className="flex flex-col gap-4 mb-2">
          <div className="flex gap-2">
            <CodeSnippet
              text={useExplicitParams ? display : display}
              className="grow w-32"
              hideCopy={true}
            />
            <a href={getPlatformLink(func)} target="_blank" rel="noopener noreferrer">
              <Tooltip message="Documentation">
                <Button className="h-8" variant="secondary">
                  <Icon id="external-link-icon" className="h-4 w-4" />
                </Button>
              </Tooltip>
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(useExplicitParams ? display : copy);
                showNotification({
                  message: "Excel formula copied to clipboard",
                  description: useExplicitParams
                    ? "With explicit parameters"
                    : undefined,
                  toastType: "success",
                });
                setOpen(false);
              }}
            >
              Copy to clipboard
            </Button>
            <Checkbox
              checked={useExplicitParams}
              onCheckedChange={(checked) => setUseExplicitParams(checked === true)}
              label="with explicit parameters"
            />
          </div>
        </div>
      );
    });
  }, [platformDataFunction, widget, useExplicitParams]);

  return (
    <BaseDialog
      className="max-w-xs lg:max-w-xl"
      open={open}
      onClose={() => setOpen(false)}
    >
      <DialogTitle>Excel Formula</DialogTitle>
      <div className="flex flex-col gap-3 flex-1">
        {excelDataFunction !== undefined && (
          <div className="flex flex-col gap-1">
            <div className="flex gap-1 items-center flex-wrap">
              <DialogDescription
                className={cn("text-ds-text-body", {
                  "text-general-label-disabled": !isProTier,
                })}
              >
                Access <strong className="text-ds-text-heading">{widget.name}</strong>
                {" data from "}
                {widget.connectionType === "single" ? (
                  "Terminal"
                ) : (
                  <strong className="text-ds-text-heading">{widget.sourceName}</strong>
                )}
                {" in Excel."}
              </DialogDescription>
              {!isProTier && <TerminalProOnlyTag />}
            </div>
            <div className="flex flex-col mt-2">{memorizedExcelDataFunction}</div>
          </div>
        )}
        {/* {platformDataFunction !== undefined && (
          <div className="flex flex-col gap-1">
            <p className="text-light-600 dark:text-light-200">Python Function</p>
            <div className="flex flex-col mt-2">{memorizedPlatformDataFunction}</div>
          </div>
        )} */}
      </div>
    </BaseDialog>
  );
}
