import { lazy, memo, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { Input } from "~/components/ds/atoms/Input";
import { Label } from "~/components/ds/atoms/Label";
import { Select } from "~/components/ds/atoms/Select";
import { Textarea } from "~/components/ds/atoms/TextArea";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "~/components/ds/dialogs/Dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ds/molecules/Tabs";
import {
  SQLParamsProvider,
  useSQLParamsContext,
} from "~/components/General/Table/SubMenus/SQLParamsContext";
import { getNewQuery } from "~/components/General/Table/utils";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import type { SqlParamDef, SqlParamDefT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import { cleanSearchParams, convertHeadersToRecord } from "~/lib/api";
import { useAppStore } from "~/lib/state/app";
import { cn, dispatchSaveState } from "~/lib/utils";

const StandaloneEditor = lazy(() =>
  import("~/components/ui/MonacoEditor").then((mod) => ({
    default: mod.StandaloneEditor,
  })),
);

const SQLMarkdownElement = lazy(() =>
  import("~/components/AI/MarkdownOverrides").then((mod) => ({
    default: mod.SQLMarkdown,
  })),
);

type SqlParamsProps = {
  open: boolean;
  onClose: () => void;
  seedNames?: string[];
};

function SQLParams(props: SqlParamsProps) {
  const updateWidget = useWidgetContext().updateWidget;
  const endpointUrl = useWidgetContext()?.widget?.endpoint?.url;
  const activeDashboardId = useWidgetContext()?.activeDashboardId;

  const {
    getSqlParams,
    addParameter,
    resetParameters,
    removeParameter,
    onSaved,
    getRemovedParamNames,
    processMultiSelectChange,
    setActiveTab,
  } = useSQLParamsContext((s) => ({
    getSqlParams: s.getSqlParams,
    addParameter: s.addParameter,
    resetParameters: s.resetParameters,
    removeParameter: s.removeParameter,
    onSaved: s.onSaved,
    getRemovedParamNames: s.getRemovedParamNames,
    processMultiSelectChange: s.processMultiSelectChange,
    setActiveTab: s.setActiveTab,
  }));

  const { hasChanges, paramIds, activeTab } = useSQLParamsContext((s) => ({
    hasChanges: s.hasChanges(),
    paramIds: s.paramIds,
    activeTab: s.activeTab,
  }));
  const totalParams = paramIds.length;

  const onSaveParameters = useCallback(() => {
    const removedParamNames = getRemovedParamNames();

    updateWidget((prev) => {
      let params = prev.storage?.params || {};
      if (removedParamNames?.length) {
        params = Object.fromEntries(
          Object.entries(params).filter(([key]) => !removedParamNames.includes(key)),
        );
      }

      params = processMultiSelectChange(params);

      return {
        ...prev,
        storage: {
          ...prev.storage,
          sqlParamDefs: getSqlParams(endpointUrl),
          params,
        },
      };
    });

    queueMicrotask(async () => {
      await dispatchSaveState();
      useAppStore.getState().updateTabParams(activeDashboardId);
      onSaved();
      props.onClose();
    });
  }, [
    updateWidget,
    getRemovedParamNames,
    processMultiSelectChange,
    getSqlParams,
    onSaved,
    props.onClose,
    endpointUrl,
    activeDashboardId,
  ]);

  const onCancel = useCallback(() => {
    resetParameters();
    props.onClose();
  }, [resetParameters, props.onClose]);

  const handleRemoveTab = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      removeParameter(index);
    },
    [removeParameter],
  );

  return (
    <BaseDialog
      open={props.open}
      onClose={onCancel}
      className="!w-[600px] !max-w-[calc(100vw-2rem)] max-h-[min(752px,calc(100vh-2rem))]"
    >
      <DialogTitle>Edit SQL Parameters</DialogTitle>

      <Tabs
        value={String(activeTab)}
        onValueChange={(val) => setActiveTab(Number(val))}
        className="flex flex-col flex-1 min-h-0"
      >
        <div
          className={cn("flex items-center gap-2", {
            "border-b border-general-border-primary": totalParams > 0,
          })}
        >
          <div className="flex-1 overflow-x-auto overflow-y-visible min-w-0">
            <TabsList>
              {paramIds.map((paramId, index) => (
                <TabsTrigger
                  key={paramId}
                  value={String(index)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap pb-2 border-b-2"
                >
                  <TabLabel index={index} />
                  <span
                    role="button"
                    onClick={(e) => handleRemoveTab(index, e)}
                    className="inline-flex items-center"
                  >
                    <Icon id="x-outline-circle" className="size-3.5" />
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <Button
            variant="secondary"
            size="xs"
            onClick={addParameter}
            className="flex-shrink-0 mb-1"
          >
            <Icon id="plus" className="size-3" />
            Add Parameter
          </Button>
        </div>

        {totalParams === 0 ? (
          <div
            className="text-center py-8 body-xs-regular text-ds-text-caption
            border border-dashed border-general-border-primary rounded-lg mt-2.5"
          >
            No parameters configured. Click "+ Add Parameter" to add one.
          </div>
        ) : (
          paramIds.map((paramId, index) => (
            <TabsContent
              key={paramId}
              value={String(index)}
              className="flex-1 min-h-0 data-[state=active]:flex flex-col"
            >
              <div className="overflow-y-auto flex-1 min-h-0 pt-4 pr-1">
                <ParamItem index={index} />
              </div>
            </TabsContent>
          ))
        )}
      </Tabs>

      <DialogFooter>
        <Button variant="outlined" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSaveParameters}
          disabled={!hasChanges}
        >
          Save Changes
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}

export default function SQLParamsRoot(props: SqlParamsProps) {
  return (
    <SQLParamsProvider seedNames={props.seedNames}>
      <SQLParams {...props} />
    </SQLParamsProvider>
  );
}

function TabLabel({ index }: { index: number }) {
  const param = useSQLParamsContext((s) => s.getParamByIndex(index));
  const label = param?.paramName ? `{{${param.paramName}}}` : `Parameter #${index + 1}`;

  return <span className="font-normal text-xs">{label}</span>;
}

const inputTypes = {
  text: "text",
  number: "number",
  date: "date",
};

const ExampleQuery = `
\`\`\`sql
SELECT DISTINCT country AS "value", country AS "label" FROM customers;

SELECT id AS "value", name AS "label" FROM products;
\`\`\``;

function SyntaxExample({ paramName }: { paramName: string }) {
  return (
    <pre className="inline-flex items-center">
      <code className="px-1">{`{{${paramName}}}`}</code>
    </pre>
  );
}

function ParamItem({ index }: { index: number }) {
  const { param, updateParameter, isUnique } = useSQLParamsContext((s) => ({
    param: s.getParamByIndex(index),
    updateParameter: s.updateParameter,
    isUnique: s.isUnique,
  }));

  const [paramNameError, setParamNameError] = useState<string | null>(null);

  const paramName = param.paramName || `Param ${index + 1}`;
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div key={`param-${index}`} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Name"
          placeholder="id, symbol, limit..."
          ref={inputRef}
          defaultValue={param.paramName}
          onChange={(value: string) => {
            setParamNameError(
              !isUnique(value, index) ? "Parameter name must be unique." : null,
            );
            if (value.includes(" ")) {
              setParamNameError("Parameter name cannot contain spaces.");
              return;
            }
            updateParameter(index, "paramName", value);
            if (inputRef.current) {
              inputRef.current.value = value;
            }
          }}
          error={!!paramNameError}
          message={paramNameError}
        />

        <Select
          label="Type"
          value={param.type}
          onChange={(value: SqlParamDef["type"]) => {
            updateParameter(index, "type", value);
            if (param.type === "endpoint" && value !== "endpoint") {
              updateParameter<"endpoint">(index, "query", undefined);
            }
          }}
          options={[
            { label: "Text", value: "text" },
            { label: "Number", value: "number" },
            { label: "Boolean", value: "boolean" },
            { label: "Date", value: "date" },
            { label: "SQL Dynamic", value: "endpoint" },
          ]}
        />
      </div>

      <Textarea
        label="Description"
        placeholder="Describe what this parameter does..."
        ref={textAreaRef}
        defaultValue={param.description}
        onChange={(value) => {
          updateParameter(index, "description", value);
          if (textAreaRef.current) {
            textAreaRef.current.value = value;
          }
        }}
        rows={3}
      />

      {param.type === "endpoint" && (
        <div className="group">
          <Tooltip
            className="max-w-[350px]"
            message={
              <div className="flex flex-col gap-2">
                <p>Write a SQL query to fetch options for this parameter.</p>
                <p>
                  The query should return two columns: <code>value</code> and{" "}
                  <code>label</code>.
                </p>
                <p>
                  The <code>value</code> column will be used as the actual parameter
                  value, while the <code>label</code> column will be displayed in the
                  UI.
                </p>
                <p>Examples:</p>
                <Suspense fallback={null}>
                  <SQLMarkdownElement content={ExampleQuery} />
                </Suspense>
              </div>
            }
          >
            <Label>Query</Label>
          </Tooltip>
          <div
            className="relative px-1 flex flex-col gap-1.5 mb-2 mt-auto rounded
            border border-general-border-primary"
            style={{ maxHeight: "auto" }}
          >
            <Suspense fallback={null}>
              <StandaloneEditor
                id={`${paramName}-${index}`}
                value={param.query}
                onChange={(value) => updateParameter<"endpoint">(index, "query", value)}
                language="sql"
                height="200px"
                options={{
                  minimap: { enabled: false },
                  lineNumbers: "off",
                  folding: false,
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 0,
                  wordWrap: "on",
                  scrollbar: {
                    vertical: "auto",
                    horizontal: "hidden",
                    verticalScrollbarSize: 6,
                    horizontalScrollbarSize: 6,
                  },
                }}
              />
            </Suspense>
          </div>
          <QueryPreview param={param as SqlParamDefT<"endpoint">} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {param.type === "boolean" ? (
          <Checkbox
            id={`param-${paramName}-value`}
            label="Default Value"
            checked={Boolean(param.value)}
            onCheckedChange={(checked) => updateParameter(index, "value", checked)}
          />
        ) : (
          <Input
            label="Default Value"
            placeholder={param.type === "date" ? "YYYY-MM-DD" : "Default value"}
            type={inputTypes[param.type] || "text"}
            value={param.value?.toString() || ""}
            onChange={(value) => {
              const stringValue = value.toString();
              let convertedValue: string | number = stringValue;
              if (param.type === "number") {
                convertedValue = Number.parseFloat(stringValue) || 0;
              }
              updateParameter(index, "value", convertedValue);
            }}
          />
        )}

        <Input
          label="Label"
          placeholder="Display label"
          value={param.label || ""}
          onChange={(value: string) => updateParameter(index, "label", value)}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <Checkbox
          id={`param-${paramName}-show`}
          label={<span className="w-full! whitespace-nowrap!">Show Parameter</span>}
          checked={Boolean(param.show !== false)}
          onCheckedChange={(checked: boolean) =>
            updateParameter(index, "show", checked)
          }
        />

        <Checkbox
          id={`param-${paramName}-multiple`}
          label={<span className="w-full! whitespace-nowrap!">Multiple Values</span>}
          checked={Boolean(param.multiple)}
          onCheckedChange={(checked: boolean) =>
            updateParameter(index, "multiple", checked)
          }
        />

        {(param.type === "text" ||
          param.type === "number" ||
          param.type === "endpoint") && (
          <Checkbox
            id={`param-${paramName}-multiSelect`}
            label={<span className="w-full! whitespace-nowrap!">Multi-Select</span>}
            checked={Boolean(param.multiSelect)}
            onCheckedChange={(checked: boolean) =>
              updateParameter(index, "multiSelect", checked)
            }
          />
        )}
      </div>

      {(param.type === "text" || param.type === "number") && (
        <>
          <hr className="border-surface-divider" />
          <ParamOptions index={index} />
        </>
      )}
    </div>
  );
}

const ParamOptions = memo(({ index }: { index: number }) => {
  const { param, updateParameter } = useSQLParamsContext((s) => ({
    param: s.getParamByIndex(index),
    updateParameter: s.updateParameter,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div>
          <h5 className="body-xs-semibold text-ds-text-heading">Options</h5>
          <p className="body-xs-regular text-ds-text-caption mt-0.5">
            Add options to create a dropdown for this parameter.
          </p>
        </div>
        <Button
          variant="secondary"
          size="xs"
          onClick={() => {
            const currentOptions = param.options || [];
            const newOptions = [...currentOptions, { value: "", label: "" }];
            updateParameter(index, "options", newOptions);
          }}
        >
          <Icon id="plus" className="size-3" />
          Add Option
        </Button>
      </div>

      {(param.options || []).length === 0 ? (
        <div className="text-center py-4 body-xs-regular text-ds-text-caption border border-dashed border-general-border-primary rounded-lg">
          No options configured. Add options to create a dropdown.
        </div>
      ) : (
        <div className="space-y-3">
          {(param.options || []).map((option, optionIndex) => (
            <div
              key={optionIndex}
              className="rounded border border-general-border-primary overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-2 bg-general-bg-secondary">
                <span className="body-xs-medium text-ds-text-body">
                  Option #{optionIndex + 1}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const currentOptions = [...(param.options || [])];
                    currentOptions.splice(optionIndex, 1);
                    updateParameter(index, "options", currentOptions);
                  }}
                  className="text-ds-text-caption hover:text-ds-text-body transition-colors"
                >
                  <Icon id="trash-04" className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3">
                <Input
                  label="Value"
                  placeholder="value"
                  value={String(option.value ?? "")}
                  onChange={(value: string) => {
                    const currentOptions = [...(param.options || [])];
                    currentOptions[optionIndex] = {
                      ...currentOptions[optionIndex],
                      value,
                    };
                    updateParameter(index, "options", currentOptions);
                  }}
                />
                <Input
                  label="Label"
                  placeholder="Display label"
                  value={option.label || ""}
                  onChange={(value: string) => {
                    const currentOptions = [...(param.options || [])];
                    currentOptions[optionIndex] = {
                      ...currentOptions[optionIndex],
                      label: value,
                    };
                    updateParameter(index, "options", currentOptions);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

type PreviewRow = { value?: unknown; label?: unknown; [k: string]: unknown };
type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; rows: PreviewRow[] };

export function QueryPreview({ param }: { param: SqlParamDefT<"endpoint"> }) {
  const endpoint = useWidgetContext()?.widget?.endpoint;
  const storedParams = useWidgetContext()?.widget?.storage?.params;
  const draftParamDefs = useSQLParamsContext((s) => s.sqlParamDefs);
  const [state, setState] = useState<PreviewState>({ status: "idle" });

  const canRun = Boolean(param.query?.trim() && endpoint?.url);

  const resolvedParams = useMemo(() => {
    const map: Record<string, string | number | boolean | string[]> = {};
    for (const p of draftParamDefs) {
      if (!p.paramName) continue;
      const saved = storedParams?.[p.paramName];
      const value = saved !== undefined && saved !== null ? saved : p.value;
      if (value === undefined || value === null || value === "") continue;
      map[p.paramName] = value as string | number | boolean | string[];
    }
    return map;
  }, [draftParamDefs, storedParams]);

  const handlePreview = useCallback(async () => {
    if (!canRun || !endpoint?.url || !param.query) return;

    const resolvedQuery = getNewQuery(
      param.query,
      resolvedParams as Record<string, string>,
    );

    const unresolved = resolvedQuery.match(/\{\{\s*\w+\s*\}\}/);
    if (unresolved) {
      setState({
        status: "error",
        message: `Cannot preview: ${unresolved[0]} has no value. Set a default value for that parameter to enable preview.`,
      });
      return;
    }

    setState({ status: "loading" });
    try {
      const { headers, newParams } = convertHeadersToRecord(endpoint.headers ?? {});
      const url = cleanSearchParams(endpoint.url, newParams);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ query: resolvedQuery }),
      });
      if (!res.ok) {
        throw new Error(res.statusText || `Request failed (${res.status})`);
      }
      const json = await res.json();
      const rows = Array.isArray(json?.rowData) ? (json.rowData as PreviewRow[]) : [];
      setState({ status: "success", rows });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Preview failed",
      });
    }
  }, [canRun, endpoint?.url, endpoint?.headers, param.query, resolvedParams]);

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="body-xs-regular text-ds-text-caption">
          Run the query to preview the options users will see.
        </span>
        <Button
          variant="secondary"
          size="xs"
          onClick={handlePreview}
          disabled={!canRun}
          loading={state.status === "loading"}
        >
          <Icon id="play-icon" className="size-3" />
          Preview
        </Button>
      </div>

      {state.status === "error" && (
        <div
          className="body-xs-regular text-alert-error border border-alert-error/40
          bg-alert-error/5 rounded px-3 py-2 break-words"
        >
          {state.message}
        </div>
      )}

      {state.status === "success" && <QueryPreviewResults rows={state.rows} />}
    </div>
  );
}

function QueryPreviewResults({ rows }: { rows: PreviewRow[] }) {
  if (rows.length === 0) {
    return (
      <div
        className="body-xs-regular text-ds-text-caption text-center py-3
        border border-dashed border-general-border-primary rounded"
      >
        Query returned no rows.
      </div>
    );
  }

  const columns = getColumns(rows);
  const hasExpectedShape = columns.includes("value") && columns.includes("label");
  const valueColumn = hasExpectedShape
    ? "value"
    : columns.length === 1
      ? columns[0]
      : undefined;
  const nullRowCount = valueColumn
    ? rows.filter((r) => isNullish(r?.[valueColumn])).length
    : 0;
  const visibleRows = rows.slice(0, 100);

  return (
    <div className="rounded border border-general-border-primary overflow-hidden">
      <div
        className="flex items-center justify-between gap-3 px-3 py-1.5
        bg-general-bg-secondary border-b border-general-border-primary"
      >
        <span className="body-xs-medium text-ds-text-body">
          {rows.length} {rows.length === 1 ? "row" : "rows"}
        </span>
        <div className="flex flex-col items-end gap-0.5">
          {!hasExpectedShape && (
            <span className="body-xs-regular text-alert-warning text-right">
              Alias columns as <code>value</code> and <code>label</code> for the
              dropdown to work
            </span>
          )}
          {nullRowCount > 0 && (
            <span className="body-xs-regular text-alert-warning text-right">
              {nullRowCount} null/empty {nullRowCount === 1 ? "value" : "values"} —
              filter with <code>WHERE … IS NOT NULL</code>
            </span>
          )}
        </div>
      </div>
      <div className="max-h-48 overflow-auto">
        <table className="w-full body-xs-regular">
          <thead className="sticky top-0 bg-general-bg-secondary">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left font-normal px-3 py-1.5 text-ds-text-caption
                  border-b border-general-border-primary whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, idx) => {
              const isNullRow = valueColumn && isNullish(row?.[valueColumn]);
              return (
                <tr
                  key={idx}
                  className={cn(
                    "border-b border-general-border-primary last:border-0",
                    { "opacity-50": isNullRow },
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col}
                      className={cn("px-3 py-1.5 text-ds-text-body break-all", {
                        "font-mono": col === "value",
                      })}
                    >
                      {formatCell(row?.[col])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > visibleRows.length && (
        <div
          className="px-3 py-1.5 body-xs-regular text-ds-text-caption
          bg-general-bg-secondary text-center border-t border-general-border-primary"
        >
          Showing first {visibleRows.length} of {rows.length} rows
        </div>
      )}
    </div>
  );
}

function getColumns(rows: PreviewRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    if (row && typeof row === "object") {
      for (const key of Object.keys(row)) seen.add(key);
    }
  }
  return Array.from(seen);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isNullish(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}
