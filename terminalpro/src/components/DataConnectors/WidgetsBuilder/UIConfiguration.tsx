import debounce from "lodash.debounce";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { Input } from "~/components/ds/atoms/Input";
import { Select } from "~/components/ds/atoms/Select";
import { Textarea } from "~/components/ds/atoms/TextArea";
import SettingsMenu from "~/components/ds/molecules/SettingsMenu";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";
import type { WidgetColumnDefT } from "~/components/types";
import { getDisplayLanguage } from "~/components/ui/monacoLanguageUtils";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { EditorLanguages } from "~/lib/types/app";
import {
  CELL_DATA_TYPES,
  CHART_TYPES,
  FORMATTER_FUNCTIONS,
  PINNED_OPTIONS,
  RENDER_FUNCTIONS,
  WIDGET_TYPES,
} from "./consts";
import { useAIGeneration } from "./hooks/useAIGeneration";
import { isTableWidgetType } from "./utils";
import { useWidgetConfigContext } from "./WidgetConfigContext";

const Section = memo(
  ({
    title,
    icon,
    tooltip: description,
    children,
    canCollapse = true,
    rightElement,
  }: {
    title: string;
    icon?: IconId;
    tooltip: string;
    canCollapse?: boolean;
    rightElement?: ReactNode;
    children: ReactNode;
  }) => (
    <SettingsMenu
      title={title}
      icon={icon}
      tooltip={description}
      canCollapse={canCollapse}
      rightElement={rightElement}
    >
      {children}
    </SettingsMenu>
  ),
);

export default function UIConfiguration() {
  const {
    handleTestAndFetchData,
    handleWidgetConfigChange,
    handleInputChange,
    handleCheckboxChange,
  } = useWidgetConfigContext((s) => ({
    handleTestAndFetchData: s.handleTestAndFetchData,
    handleWidgetConfigChange: s.handleWidgetConfigChange,
    handleInputChange: s.handleInputChange,
    handleCheckboxChange: s.handleCheckboxChange,
  }));

  const { state, isTableWidget, widgetType } = useWidgetConfigContext((s) => ({
    isTableWidget: isTableWidgetType(s.config.type),
    widgetType: s.config.type,
    state: {
      endpoint: s.formState.endpoint,
      authRequired: s.formState.authRequired,
      authHeaderKey: s.formState.authHeaderKey,
      tokenBearer: s.formState.tokenBearer,
      previewData: s.formState.previewData,
      lastTestedEndpoint: s.formState.lastTestedEndpoint,
      error: s.formState.error,
      isLoading: s.formState.isLoading,
      isGeneratingWithAI: s.formState.isGeneratingWithAI,
    },
  }));

  const handleGenerateWithAI = useAIGeneration();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 pt-0 flex flex-col gap-4">
        <Section
          title="Endpoint Configuration"
          icon="dataflow-04"
          tooltip="Configure your API endpoint and authentication"
        >
          <div className="flex flex-col gap-4">
            <Input
              label="Endpoint"
              autoComplete="on"
              id="endpoint"
              placeholder="https://api.example.com/data"
              value={state.endpoint}
              onChange={handleInputChange("endpoint")}
            />

            <div className="flex flex-col gap-2">
              <Checkbox
                id="auth-required"
                label="Auth Required?"
                checked={state.authRequired}
                onCheckedChange={handleCheckboxChange}
              />
            </div>

            {state.authRequired && (
              <>
                <Input
                  label="Auth Header Key"
                  placeholder="Authorization"
                  autoComplete="on"
                  value={state.authHeaderKey}
                  onChange={handleInputChange("authHeaderKey")}
                />

                <Input
                  label="Token/Bearer"
                  placeholder="Bearer your-token-here"
                  value={state.tokenBearer}
                  autoComplete="on"
                  onChange={handleInputChange("tokenBearer")}
                />
              </>
            )}

            <div className="flex justify-start gap-2.5">
              <Button
                variant="primary"
                size="sm"
                onClick={handleTestAndFetchData}
                loading={state.isLoading}
                loadingChildren="Testing..."
                disabled={!state.endpoint.trim()}
              >
                {state.previewData ? "Re-test Endpoint" : "Test Endpoint"}
              </Button>
              <Button variant="outlined" size="sm" disabled={!state.previewData}>
                Reset
              </Button>
            </div>

            {!state.previewData && state.endpoint.trim() && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
                <div className="flex items-start gap-2">
                  <Icon
                    id="info-circled-icon"
                    className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"
                  />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-medium">Test your endpoint</span> to
                    auto-detect the widget type and preview your data.
                  </p>
                </div>
              </div>
            )}

            {state.error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Error: {state.error}
                </p>
              </div>
            )}
          </div>
        </Section>

        {state.previewData && (
          <>
            <Section
              title="Widget Type"
              icon="layout-top"
              tooltip="Select the type of widget to create"
            >
              <div className="flex flex-col gap-4">
                <Select
                  label="Widget Type"
                  value={widgetType}
                  onChange={handleWidgetConfigChange("type")}
                  options={WIDGET_TYPES}
                />

                {state.endpoint !== state.lastTestedEndpoint &&
                state.lastTestedEndpoint ? (
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md">
                    <div className="flex items-start gap-2">
                      <Icon
                        id="warning-icon"
                        className="size-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0"
                      />
                      <div className="text-sm">
                        <p className="text-orange-700 dark:text-orange-300 font-medium">
                          Endpoint changed - widget type may be outdated
                        </p>
                        <p className="text-orange-600 dark:text-orange-400 mt-1 text-xs">
                          Re-test your endpoint to auto-detect the correct widget type
                          for the new data structure.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <div className="flex items-start gap-2">
                      <Icon
                        id="info-circled-icon"
                        className="size-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"
                      />
                      <div className="text-sm">
                        <p className="text-blue-700 dark:text-blue-300 font-medium">
                          Auto-detected widget type:{" "}
                          <span className="font-semibold">
                            {WIDGET_TYPES.find((w) => w.value === widgetType)?.label ||
                              widgetType}
                          </span>
                        </p>
                        {!inSnowflakeNativeApp && (
                          <>
                            <p className="text-blue-600 dark:text-blue-400 mt-1 text-xs">
                              Based on your endpoint's response structure.
                              Auto-detection considers:
                            </p>
                            <ul className="text-blue-600 dark:text-blue-400 mt-1 text-xs list-disc list-inside space-y-0.5">
                              <li>Content-Type header (text/markdown → Markdown)</li>
                              <li>Plotly JSON structure (data + layout → Chart)</li>
                              <li>Array of objects → Table or Newsfeed</li>
                              <li>Single values → Metric</li>
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            <Section
              icon="file-02"
              title="Widget Metadata"
              tooltip="Basic widget details and metadata"
              rightElement={
                <Button
                  variant="primary"
                  size="xs"
                  loading={state.isGeneratingWithAI}
                  loadingChildren="Generating..."
                  onClick={handleGenerateWithAI}
                  disabled={!state.endpoint.trim()}
                >
                  <Icon id="sparkles-icon" className="size-4" />
                  Generate with AI
                </Button>
              }
            >
              <WidgetInfoSection />
            </Section>

            <div className="flex flex-col gap-4">
              <Section
                icon="database-01"
                title="Data"
                tooltip="Configure data handling and WebSocket settings"
              >
                <DataSection />
              </Section>

              <ParametersWithSection />

              <Section
                title="Layout"
                icon="layout"
                tooltip="Configure widget grid dimensions and sizing"
              >
                <LayoutSection />
              </Section>

              {isTableWidget && (
                <>
                  <TableWithSection />
                  <Section
                    title="Chart"
                    icon="pie-chart-icon"
                    tooltip="Configure chart-specific visualization settings"
                  >
                    <ChartSection />
                  </Section>
                </>
              )}

              <Section
                title="Advanced"
                icon="cog-icon"
                tooltip="Configure refresh intervals, caching, and other advanced settings"
              >
                <AdvancedSection />
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WidgetInfoSection() {
  const { name, description, category, subCategory, handleWidgetConfigChange } =
    useWidgetConfigContext((s) => ({
      name: s.config.name,
      description: s.config.description,
      category: s.config.category,
      subCategory: s.config.subCategory,
      handleWidgetConfigChange: s.handleWidgetConfigChange,
    }));

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Name"
        placeholder="My Custom Widget"
        value={name}
        onChange={handleWidgetConfigChange("name")}
      />

      <Textarea
        label="Description"
        placeholder="Brief description of what this widget displays"
        value={description}
        onChange={handleWidgetConfigChange("description")}
        rows={3}
      />

      <Input
        label="Category"
        placeholder="e.g., Equity, Economy, Custom"
        value={category}
        onChange={handleWidgetConfigChange("category")}
      />

      <Input
        label="Sub Category"
        placeholder="e.g., Options, Fundamentals"
        value={subCategory}
        onChange={handleWidgetConfigChange("subCategory")}
      />
    </div>
  );
}

function DataSection() {
  const { dataKey, wsEndpoint, wsRowIdColumn, isLiveGrid, handleWidgetConfigChange } =
    useWidgetConfigContext((s) => ({
      dataKey: s.config.dataKey,
      wsEndpoint: s.config.wsEndpoint,
      wsRowIdColumn: s.config.wsRowIdColumn,
      isLiveGrid: s.config.type === "live_grid",
      handleWidgetConfigChange: s.handleWidgetConfigChange,
    }));

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Data Key"
        placeholder="customDataKey"
        value={dataKey}
        onChange={handleWidgetConfigChange("dataKey")}
      />

      {isLiveGrid && (
        <>
          <Input
            label="WebSocket Endpoint"
            placeholder="ws"
            value={wsEndpoint}
            onChange={handleWidgetConfigChange("wsEndpoint")}
          />

          <Input
            label="WebSocket Row ID Column"
            placeholder="symbol"
            value={wsRowIdColumn}
            onChange={handleWidgetConfigChange("wsRowIdColumn")}
          />
        </>
      )}
    </div>
  );
}

function ParametersWithSection() {
  const { addParameter } = useWidgetConfigContext((s) => ({
    addParameter: s.addParameter,
  }));

  return (
    <Section
      title="Parameters"
      icon="sliders-02"
      tooltip="Configure widget parameters for dynamic data queries"
      rightElement={
        <Button
          variant="outlined"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            addParameter();
          }}
        >
          <Icon id="plus" className="size-3 mr-1" />
          Add Parameter
        </Button>
      }
    >
      <ParametersSection />
    </Section>
  );
}

function ParametersSection() {
  const { widgetType, params, removeParameter, updateParameter } =
    useWidgetConfigContext((s) => ({
      widgetType: s.config.type,
      params: s.config.params,
      removeParameter: s.removeParameter,
      updateParameter: s.updateParameter,
    }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-light-500 dark:text-light-400">
        Add parameters that users can configure when using this widget
      </p>

      {params.length === 0 ? (
        <div className="text-center py-8 text-sm text-light-500 dark:text-light-400 border border-dashed border-light-200 dark:border-dark-700 rounded-lg">
          No parameters configured. Click "Add Parameter" to add one.
        </div>
      ) : (
        <div className="space-y-4">
          {params.map((param, index) => (
            <SettingsMenu
              key={index}
              title={`Parameter #${index + 1}`}
              tooltip="Configure parameter settings"
              canCollapse={false}
              rightElement={
                <button onClick={() => removeParameter(index)}>
                  <Icon id="trash-04" className="size-4" />
                </button>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Parameter Name"
                  placeholder="id, symbol, limit..."
                  value={param.paramName}
                  onChange={(value) => updateParameter(index, "paramName", value)}
                />

                <Select
                  label="Type"
                  value={param.type}
                  onChange={(value) => updateParameter(index, "type", value)}
                  options={[
                    { label: "Text", value: "text" },
                    { label: "Number", value: "number" },
                    { label: "Boolean", value: "boolean" },
                    { label: "Date", value: "date" },
                    { label: "Endpoint", value: "endpoint" },
                  ]}
                />
              </div>

              <div className="mt-3">
                <Textarea
                  label="Description"
                  placeholder="Describe what this parameter does..."
                  value={param.description}
                  onChange={(value) => updateParameter(index, "description", value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                {param.type === "boolean" ? (
                  <Checkbox
                    id={`param-${index}-value`}
                    label="Default Value"
                    checked={Boolean(param.value)}
                    onCheckedChange={(checked) =>
                      updateParameter(index, "value", checked)
                    }
                  />
                ) : param.type === "date" ? (
                  <Input
                    label="Default Value"
                    placeholder="YYYY-MM-DD"
                    type="date"
                    value={param.value?.toString() || ""}
                    onChange={(value) => updateParameter(index, "value", value)}
                  />
                ) : (
                  <Input
                    label="Default Value"
                    placeholder="Default value"
                    type={param.type === "number" ? "number" : "text"}
                    value={param.value?.toString() || ""}
                    onChange={(value) => {
                      const stringValue = value.toString();
                      let convertedValue: string | number | boolean = stringValue;
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
                  value={(param as any).label || ""}
                  onChange={(value) => updateParameter(index, "label", value)}
                />

                {widgetType === "ssrm_advanced" &&
                  param.type === "text" &&
                  param.paramName === "query" && (
                    <Select
                      label="Editor Language"
                      value={param.language || "text"}
                      onChange={(value) =>
                        updateParameter(index, "language" as any, value)
                      }
                      options={EditorLanguages.map((lang) => ({
                        label: getDisplayLanguage(lang),
                        value: lang,
                      }))}
                    />
                  )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                {param.type === "endpoint" && (
                  <Input
                    label="Options Endpoint"
                    placeholder="Endpoint for options"
                    value={(param as any).optionsEndpoint || ""}
                    onChange={(value) =>
                      updateParameter(index, "optionsEndpoint" as any, value)
                    }
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-4 mt-3">
                <Checkbox
                  id={`param-${index}-show`}
                  label="Show Parameter"
                  checked={Boolean((param as any).show !== false)}
                  onCheckedChange={(checked) => updateParameter(index, "show", checked)}
                />

                <Checkbox
                  id={`param-${index}-multiple`}
                  label="Multiple Values"
                  checked={Boolean((param as any).multiple)}
                  onCheckedChange={(checked) =>
                    updateParameter(index, "multiple", checked)
                  }
                />

                {(param.type === "text" ||
                  param.type === "number" ||
                  param.type === "endpoint") && (
                  <Checkbox
                    id={`param-${index}-multiSelect`}
                    label="Multi-Select"
                    checked={Boolean((param as any).multiSelect)}
                    onCheckedChange={(checked) =>
                      updateParameter(index, "multiSelect", checked)
                    }
                  />
                )}
              </div>

              {(param.type === "text" || param.type === "number") && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="text-sm font-medium text-light-600 dark:text-dark-50">
                      Options
                    </h5>
                    <Button
                      variant="outlined"
                      size="sm"
                      onClick={() => {
                        const currentOptions = (param as any).options || [];
                        const newOptions = [
                          ...currentOptions,
                          { value: "", label: "" },
                        ];
                        updateParameter(index, "options" as any, newOptions);
                      }}
                    >
                      <Icon id="plus" className="size-3 mr-1" />
                      Add Option
                    </Button>
                  </div>

                  {((param as any).options || []).length === 0 ? (
                    <div className="text-center py-4 text-xs text-light-500 dark:text-light-400 border border-dashed border-light-200 dark:border-dark-700 rounded-lg">
                      No options configured. Add options to create a dropdown.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {((param as any).options || []).map(
                        (option: any, optionIndex: number) => (
                          <div key={optionIndex} className="flex gap-2 items-end">
                            <Input
                              label={`Option ${optionIndex + 1} Value`}
                              placeholder="value"
                              value={option.value || ""}
                              onChange={(value) => {
                                const currentOptions = [
                                  ...((param as any).options || []),
                                ];
                                currentOptions[optionIndex] = {
                                  ...currentOptions[optionIndex],
                                  value,
                                };
                                updateParameter(
                                  index,
                                  "options" as any,
                                  currentOptions,
                                );
                              }}
                            />
                            <Input
                              label="Label"
                              placeholder="Display label"
                              value={option.label || ""}
                              onChange={(value) => {
                                const currentOptions = [
                                  ...((param as any).options || []),
                                ];
                                currentOptions[optionIndex] = {
                                  ...currentOptions[optionIndex],
                                  label: value,
                                };
                                updateParameter(
                                  index,
                                  "options" as any,
                                  currentOptions,
                                );
                              }}
                            />
                            <Button
                              variant="outlined"
                              size="sm"
                              onClick={() => {
                                const currentOptions = [
                                  ...((param as any).options || []),
                                ];
                                currentOptions.splice(optionIndex, 1);
                                updateParameter(
                                  index,
                                  "options" as any,
                                  currentOptions,
                                );
                              }}
                            >
                              <Icon id="trash-04" className="size-4" />
                            </Button>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
            </SettingsMenu>
          ))}
        </div>
      )}
    </div>
  );
}

type GridKeys = "w" | "h" | "minW" | "minH" | "maxW" | "maxH";
function LayoutSection() {
  const { layout, handleWidgetConfigChange } = useWidgetConfigContext((s) => ({
    layout: s.config.gridData,
    handleWidgetConfigChange: s.handleWidgetConfigChange,
  }));

  const onChange = useCallback(
    (field: GridKeys) =>
      debounce((value: string | number | undefined) => {
        handleWidgetConfigChange(`gridData.${field}`)(
          value ? Number.parseInt(value.toString(), 10) : undefined,
        );
      }, 300),
    [handleWidgetConfigChange],
  );

  const refs = useRef<{ [key in GridKeys]?: HTMLInputElement | null }>({});

  useEffect(() => {
    for (const key in refs.current) {
      if (refs.current[key]) {
        refs.current[key]!.value = layout[key].toString();
      }
    }
  }, [layout]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <Input
        ref={(el) => (refs.current.w = el)}
        label="Width"
        type="number"
        placeholder="20"
        min={4}
        max={40}
        defaultValue={layout.w?.toString()}
        onChange={onChange("w")}
      />

      <Input
        ref={(el) => (refs.current.h = el)}
        label="Height"
        type="number"
        placeholder="9"
        defaultValue={layout.h?.toString()}
        min={2}
        onChange={onChange("h")}
      />

      <Input
        ref={(el) => (refs.current.minW = el)}
        label="Min Width"
        type="number"
        placeholder="10"
        defaultValue={layout.minW?.toString()}
        min={4}
        max={40}
        onChange={onChange("minW")}
      />

      <Input
        ref={(el) => (refs.current.minH = el)}
        label="Min Height"
        type="number"
        placeholder="5"
        min={2}
        defaultValue={layout.minH?.toString()}
        onChange={onChange("minH")}
      />

      <Input
        ref={(el) => (refs.current.maxW = el)}
        label="Max Width"
        type="number"
        placeholder="40"
        min={4}
        max={40}
        defaultValue={layout.maxW?.toString()}
        onChange={onChange("maxW")}
      />

      <Input
        ref={(el) => (refs.current.maxH = el)}
        label="Max Height"
        type="number"
        min={5}
        placeholder="100"
        defaultValue={layout.maxH?.toString()}
        onChange={onChange("maxH")}
      />
    </div>
  );
}

function ColumnsSection() {
  const { totalColDefs, addColumnDef, showAllColumns, hideAllColumns } =
    useWidgetConfigContext((s) => ({
      totalColDefs: s.config.columnsDefs?.length || 0,
      addColumnDef: s.addColumnDef,
      showAllColumns: s.showAllColumns,
      hideAllColumns: s.hideAllColumns,
    }));

  const handleAddColumn = useCallback(() => {
    addColumnDef();
    // scroll new column into view
    setTimeout(() => {
      const container = document.getElementById("columns-section-container");
      if (container) {
        container.lastElementChild?.scrollIntoView({
          behavior: "auto",
          block: "center",
        });
      }
    }, 100);
  }, [addColumnDef]);

  const elementMemo = useMemo(
    () => (
      <>
        <div className="pt-2 mt-2">
          <div className="mb-4">
            <div className="flex gap-2 mb-4">
              {totalColDefs > 0 && (
                <>
                  <Button variant="outlined" size="sm" onClick={showAllColumns}>
                    Show All
                  </Button>
                  <Button variant="outlined" size="sm" onClick={hideAllColumns}>
                    Hide All
                  </Button>
                </>
              )}

              <Button variant="outlined" size="sm" onClick={handleAddColumn}>
                <Icon id="plus" className="size-3 mr-1" />
                Add Column
              </Button>
            </div>
          </div>
        </div>
        {totalColDefs === 0 ? (
          <div
            className="text-center py-8 text-sm text-light-500 dark:text-light-400
            border border-dashed border-light-200 dark:border-dark-700 rounded-lg"
          >
            No column definitions configured. Click "Add Column" to add one.
          </div>
        ) : (
          <div className="space-y-4" id="columns-section-container">
            {Array.from({ length: totalColDefs }).map((_, index) => (
              <ColumnDefItem index={index} key={`column-def-item-${index}`} />
            ))}
          </div>
        )}
      </>
    ),
    [totalColDefs, showAllColumns, hideAllColumns, handleAddColumn],
  );

  return (
    <div className="border-t border-light-200 dark:border-dark-700 pt-4 mt-4">
      <div className="mb-4">
        <div>
          <h4 className="text-sm font-medium text-light-600 dark:text-dark-50">
            Column Definitions
          </h4>
          <p className="text-xs text-light-500 dark:text-light-400 mt-1">
            Configure individual column properties for the table
          </p>
        </div>
      </div>

      {elementMemo}
    </div>
  );
}

function TableWithSection() {
  return (
    <Section
      title="Table"
      icon="table-02"
      tooltip="Configure table-specific settings and chart integration"
    >
      <TableSection />
    </Section>
  );
}

function TableSection() {
  const { enableCharts, showAll, chartViewEnabled, chartType } = useWidgetConfigContext(
    (s) => ({
      enableCharts: s.config.enableCharts,
      showAll: s.config.showAll,
      chartViewEnabled: s.config.chartViewEnabled,
      chartType: s.config.chartType,
    }),
  );

  const handleWidgetConfigChange = useWidgetConfigContext(
    (s) => s.handleWidgetConfigChange,
  );

  const columnsSectionMemo = useMemo(() => <ColumnsSection />, []);

  return (
    <div className="flex flex-col gap-4">
      <Checkbox
        id="enable-charts"
        label="Enable Charts"
        checked={enableCharts}
        onCheckedChange={handleWidgetConfigChange("enableCharts")}
      />

      <Checkbox
        id="show-all"
        label="Show All Data"
        checked={showAll}
        onCheckedChange={handleWidgetConfigChange("showAll")}
      />

      <Checkbox
        id="chart-view-enabled"
        label="Chart View Enabled by Default"
        checked={chartViewEnabled}
        onCheckedChange={handleWidgetConfigChange("chartViewEnabled")}
      />

      {chartViewEnabled && (
        <Select
          label="Default Chart Type"
          value={chartType}
          onChange={handleWidgetConfigChange("chartType")}
          options={CHART_TYPES}
        />
      )}

      {columnsSectionMemo}
    </div>
  );
}

const ColumnDefItem = memo(({ index }: { index: number }) => {
  const { updateColumnDef, removeColumnCb } = useWidgetConfigContext((s) => ({
    updateColumnDef: s.updateColumnDef,
    removeColumnCb: s.removeColumnDef,
  }));

  const removeColumn = useCallback(
    () => removeColumnCb(index),
    [index, removeColumnCb],
  );

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const column = useWidgetConfigContext((s) => s.getColumnDef(index)!);
  const lastFocusedRef = useRef<string | null>(null);

  useEffect(() => {
    // restore focus to last focused input after re-render
    if (lastFocusedRef.current && inputRefs.current[lastFocusedRef.current]) {
      inputRefs.current[lastFocusedRef.current]!.focus();
    }
  }, [column, inputRefs]);

  const handleFocus = useCallback(
    (field: string) => {
      lastFocusedRef.current = field;
    },
    [lastFocusedRef],
  );

  const updateField = useCallback(
    (field: keyof WidgetColumnDefT) =>
      debounce((value: any) => {
        let updatedValue = value;
        if (field === "width" || field === "minWidth" || field === "maxWidth") {
          updatedValue = value ? Number.parseInt(value.toString(), 10) : undefined;
        } else if (field === "hide") {
          updatedValue = Boolean(value);
        } else if (field === "renderFn") {
          updatedValue = value === "none" ? [] : [value];
        }

        if (inputRefs.current[field]) {
          inputRefs.current[field]!.value = value;
        }
        updateColumnDef(index, field, updatedValue);
      }, 300),

    [index, updateColumnDef, inputRefs],
  );

  return (
    <SettingsMenu
      key={`column-def-${index}-${column?.field}`}
      title={`Column #${index + 1}`}
      tooltip="Configure column settings"
      canCollapse={false}
      rightElement={
        <button
          onClick={removeColumn}
          key={`remove-column-btn-${index}-${column?.field}`}
        >
          <Icon id="trash-04" className="size-4" />
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input
          ref={(el) => (inputRefs.current.field = el)}
          label="Field"
          placeholder="column1, price, symbol..."
          defaultValue={column.field}
          onChange={updateField("field")}
          onFocus={() => handleFocus("field")}
        />

        <Input
          ref={(el) => (inputRefs.current.headerName = el)}
          label="Header Name"
          placeholder="Display name"
          defaultValue={column.headerName}
          onChange={updateField("headerName")}
          onFocus={() => handleFocus("headerName")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Select
          label="Chart Data Type"
          value={column.chartDataType}
          onChange={updateField("chartDataType")}
          options={CELL_DATA_TYPES}
        />

        <Select
          label="Cell Data Type"
          value={column.cellDataType}
          onChange={updateField("cellDataType")}
          options={CELL_DATA_TYPES}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Select
          label="Formatter Function"
          value={column.formatterFn}
          onChange={updateField("formatterFn")}
          options={FORMATTER_FUNCTIONS}
        />

        <Select
          label="Render Function"
          value={column.renderFn?.[0] || "none"}
          onChange={updateField("renderFn")}
          options={RENDER_FUNCTIONS}
        />
      </div>

      <div className="grid grid-cols-4 gap-3 mt-3">
        <Input
          ref={(el) => (inputRefs.current.width = el)}
          label="Width"
          type="number"
          placeholder="100"
          defaultValue={column.width?.toString() || ""}
          onChange={updateField("width")}
          onFocus={() => handleFocus("width")}
        />

        <Input
          ref={(el) => (inputRefs.current.minWidth = el)}
          label="Min Width"
          type="number"
          placeholder="50"
          defaultValue={column.minWidth?.toString() || ""}
          onChange={updateField("minWidth")}
          onFocus={() => handleFocus("minWidth")}
        />

        <Input
          ref={(el) => (inputRefs.current.maxWidth = el)}
          label="Max Width"
          type="number"
          placeholder="200"
          defaultValue={column.maxWidth?.toString() || ""}
          onChange={updateField("maxWidth")}
          onFocus={() => handleFocus("maxWidth")}
        />

        <Select
          label="Pinned"
          value={(column.pinned || "none") as string}
          onChange={updateField("pinned")}
          options={PINNED_OPTIONS}
        />
      </div>

      <div className="flex items-center mt-3">
        <Checkbox
          id={`hide-column-${index}`}
          label="Hide Column"
          checked={column.hide}
          onCheckedChange={updateField("hide")}
          onFocus={() => handleFocus("hide")}
        />
      </div>
    </SettingsMenu>
  );
});

function ChartSection() {
  const { chartType, handleWidgetConfigChange } = useWidgetConfigContext((s) => ({
    chartType: s.config.chartType,
    handleWidgetConfigChange: s.handleWidgetConfigChange,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Chart Type"
        value={chartType}
        onChange={handleWidgetConfigChange("chartType")}
        options={CHART_TYPES}
      />
    </div>
  );
}

function AdvancedSection() {
  const {
    runButton,
    refetchInterval,
    dataUpdateDisplay,
    staleTime,
    handleWidgetConfigChange,
  } = useWidgetConfigContext((s) => ({
    runButton: s.config.runButton,
    refetchInterval: s.config.refetchInterval,
    dataUpdateDisplay: s.config.dataUpdateDisplay,
    staleTime: s.config.staleTime,
    handleWidgetConfigChange: s.handleWidgetConfigChange,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Checkbox
        id="run-button"
        label="Show Run Button"
        checked={runButton}
        onCheckedChange={handleWidgetConfigChange("runButton")}
      />

      <Input
        label="Refetch Interval (ms or cron)"
        type="text"
        placeholder="900000 or */15 * * * *"
        value={refetchInterval?.toString()}
        onChange={(value) => {
          const nextValue = value.toString().trim();
          const numberValue = /^\d+$/.test(nextValue)
            ? Number.parseInt(nextValue, 10)
            : null;

          handleWidgetConfigChange("refetchInterval")(
            nextValue.toLowerCase() === "false"
              ? false
              : numberValue || nextValue || 900000,
          );
        }}
      />

      <Input
        label="Data Update Display (cron)"
        type="text"
        placeholder="0 8 * * 1-5"
        value={dataUpdateDisplay ?? ""}
        onChange={handleWidgetConfigChange("dataUpdateDisplay")}
      />

      <Input
        label="Stale Time (ms)"
        type="number"
        placeholder="300000"
        value={staleTime?.toString()}
        onChange={(value) =>
          handleWidgetConfigChange("staleTime")(
            Number.parseInt(value.toString(), 10) || 300000,
          )
        }
      />
    </div>
  );
}
