import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { type UseQueryOptions, useQueries } from "@tanstack/react-query";
import isEqual from "lodash.isequal";
import {
  type MutableRefObject,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { FormParamElement } from "~/components/DraggableCard/FormParamDef";
import { Button } from "~/components/ds/atoms/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ds/atoms/DropdownMenu";
import { useIsFirstRender } from "~/components/General/Table/hooks/utils";
import { AdvancedSelect, type TSelectValues } from "~/components/NewAdvancedSelect";
import { ToggleSelect } from "~/components/ToggleSelect";
import type { ParamDef, ParamDefT, Ticker } from "~/components/types";
import { SingleDatePicker } from "~/components/ui/SingleDatePicker";
import { useWidgetContext } from "~/components/Widget.context";
import AdvancedSelectedTicker from "~/components/Widgets/Helpers/AdvancedSelectTicker";
import GroupDropdown from "~/components/Widgets/Helpers/GroupDropdown";
import { useParamGroupBindings } from "~/components/Widgets/Helpers/useParamGroupBindings";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import {
  beautifySlug,
  cn,
  createParamDefs,
  ensureArray,
  getCellOnClickParams,
  getEndpointParamRequestArgs,
  getJsonWidget,
  isSSRMType,
  triggerCustomEvent,
  useEventListener,
} from "~/lib/utils";
import DebouncedInput from "../DebouncedInput";
import { someTruthy } from "../utils";
import CompareTermsParam from "./CompareTermsParam";
import { TabsParam } from "./TabsParam";

export function FormParamDialog() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild={true}>
        <Button size="xs" variant="outlined" className="h-[20px]">
          Open Form
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[320px] max-w-[600px] max-h-[600px] overflow-y-auto z-10"
        side="bottom"
        align="start"
      >
        <FormParamElement />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ParamsT = Record<string, any | any[]>;

type ParamsStateT = { localParams: ParamsT; mainTicker: Ticker | undefined };

function replaceFailed(selected: string | string[] | undefined, localValue?: any) {
  if (selected === "Failed to fetch options") return localValue;
  return selected;
}

export function useWidgetParamsPositions(enabled = true) {
  const { widget, updateWidget } = useWidgetContext();
  const { setWidgetCopilotDraftParams, beginWidgetCopilotExecution } =
    useShallowCopilotDataStore((s) => ({
      setWidgetCopilotDraftParams: s.setWidgetCopilotDraftParams,
      beginWidgetCopilotExecution: s.beginWidgetCopilotExecution,
    }));

  const params: ParamsT = widget?.storage?.params ?? {};

  const [state, dispatch] = useStateReducer<ParamsStateT>({
    localParams: params,
    mainTicker: widget.data?.mainTicker,
  });

  const currentParamsRef = useRef<ParamsT>(params);
  const invalidResponseRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (isEqual(currentParamsRef.current, params)) return;

    currentParamsRef.current = params;
    dispatch({
      localParams: (prev) => (isEqual(prev, params) ? prev : params),
    });
  }, [params, dispatch]);

  const syncCopilotParamsState = useCallback(
    (draftParams: ParamsT, executedParams: ParamsT = {}) => {
      setWidgetCopilotDraftParams(widget.id, { ...executedParams, ...draftParams });
    },
    [setWidgetCopilotDraftParams, widget.id],
  );

  const [sqlEditorFocused, setSqlEditorFocused] = useState(false);
  useEventListener(`sqlEditorFocus-${widget?.id}`, (detail) => {
    setSqlEditorFocused(Boolean(detail?.focused));
  });

  const { updateGroupedParam } = useParamGroupBindings();

  const {
    hasForm,
    tickerParamDef,
    paramsGroupedByRow,
    endpointParams,
    hasParams,
    tabsParams,
    sqlParamNames,
  } = useMemo(() => {
    let tickerParamDef: ParamDefT<"ticker"> | undefined;
    const endpointParams = {} as Record<string, ParamDefT<"endpoint">>;
    const paramsGroupedByRow: Record<number, ParamDef[]> = {};
    const tabsParams: ParamDefT<"tabs">[] = [];
    let hasForm = false;
    let hasParams = false;
    const widgetJSON = getJsonWidget(widget);

    const widgetParams = createParamDefs(widgetJSON);
    const sqlParamDefs = createParamDefs({ params: widget?.storage?.sqlParamDefs });
    const sqlParamNames = new Set<string>(
      (widget?.storage?.sqlParamDefs ?? []).map((p) => p.paramName),
    );
    const paramGroups = widget?.paramGroups ?? {};
    const badgeParams = new Set(
      getCellOnClickParams(widgetJSON).concat(
        Object.keys(paramGroups).filter((groupId) => paramGroups[groupId]),
      ),
    );
    let maxRows = 0;

    for (const param of [...widgetParams, ...sqlParamDefs]) {
      const isHiddenBadgeParam =
        !param?.show &&
        (badgeParams.has(param.paramName) ||
          (param.type === "endpoint" && badgeParams.has(param.groupById)));

      if (param?.type === "form") {
        hasForm = true;
        continue;
      }
      if (param?.type === "ticker") {
        tickerParamDef = param;
        hasParams = true;
        continue;
      }
      // Collect tabs params separately - they render in their own row below navbar
      if (param?.type === "tabs") {
        tabsParams.push(param);
        hasParams = true;
        continue;
      }

      if (param?.show || isHiddenBadgeParam) {
        if (param?.show && param?.type === "endpoint")
          endpointParams[param.paramName] = param;

        // Group parameters by their row number (default to 0 if not specified)
        const rowNumber = param.row ?? 0;
        if (!paramsGroupedByRow[rowNumber]) {
          paramsGroupedByRow[rowNumber] = [];
        }
        paramsGroupedByRow[rowNumber].push(param);
        maxRows = Math.max(maxRows, rowNumber);
        hasParams = true;
      }
    }

    // Ensure all rows up to maxRows are present
    for (let i = 0; i <= maxRows; i++)
      !paramsGroupedByRow[i] && (paramsGroupedByRow[i] = []);

    return {
      tickerParamDef,
      paramsGroupedByRow,
      endpointParams,
      hasForm,
      hasParams,
      tabsParams,
      sqlParamNames,
    };
  }, [widget?.paramGroups, widget?.params, widget?.storage?.sqlParamDefs]);

  const syncParams = useCallback(
    (props?: { params?: ParamsT; mainTicker?: Ticker }) => {
      const localParams = props?.params ?? state.localParams;
      const mainTicker = props?.mainTicker ?? state.mainTicker;
      const params = currentParamsRef.current;
      const nextExecutedParams = { ...params, ...localParams };

      if (
        Object.keys(localParams).every((key) => params[key] === localParams[key]) &&
        mainTicker?.symbol === widget.data?.mainTicker?.symbol
      ) {
        if (!widget.runButton) return;
        beginWidgetCopilotExecution(widget.id, nextExecutedParams);
        return updateWidget((prev) => ({ ...prev, refreshQuery: Date.now() }));
      }
      triggerCustomEvent(`staleParams-${widget?.id}`, false);
      currentParamsRef.current = nextExecutedParams;
      syncCopilotParamsState(nextExecutedParams);
      beginWidgetCopilotExecution(widget.id, nextExecutedParams);

      updateWidget((prev) => {
        const newWidget = { ...prev };
        if (mainTicker?.symbol !== prev.data.mainTicker?.symbol) {
          newWidget.data.mainTicker = mainTicker;
        }

        newWidget.storage = {
          ...newWidget.storage,
          params: {
            ...(newWidget?.storage?.params ?? {}),
            ...localParams,
          },
        };

        // Reset SSRM request
        if (isSSRMType(prev.type)) {
          newWidget.storage.ssmRequest = undefined;
        }

        return newWidget;
      });
    },
    [
      updateWidget,
      state,
      widget.data?.mainTicker,
      currentParamsRef,
      syncCopilotParamsState,
      beginWidgetCopilotExecution,
    ],
  );

  const syncParamsRef = useRef(syncParams);

  useEffect(() => {
    syncParamsRef.current = syncParams;
  }, [syncParams]);

  const updateParams = useCallback(
    (key: string, value: any, mainTicker?: Ticker) => {
      const updatedGroupedParam = updateGroupedParam(key, value);

      if (!widget.runButton && !updatedGroupedParam) {
        syncParamsRef.current({ params: { [key]: value }, mainTicker });
      }

      dispatch({
        localParams: (prev) => {
          const localParams = { ...prev, [key]: value };
          if (widget.runButton) {
            const params = currentParamsRef.current;
            const staleParams = Object.keys(localParams).some(
              (paramKey) => params?.[paramKey] !== localParams[paramKey],
            );
            queueMicrotask(() => {
              triggerCustomEvent(`staleParams-${widget?.id}`, staleParams);
              syncCopilotParamsState(localParams, params);
            });
          }
          return localParams;
        },
        ...(mainTicker && { mainTicker }),
      });
    },
    [
      dispatch,
      widget?.runButton,
      syncParamsRef,
      currentParamsRef,
      syncCopilotParamsState,
      updateGroupedParam,
    ],
  );

  const queriesMemo = useMemo(() => {
    const queries = Object.values(endpointParams).map((param) => {
      const { url, reqInit } = getEndpointParamRequestArgs(
        widget,
        param,
        state.localParams,
      );

      return {
        queryKey: [url, "endpoint_options", param.groupById],
        queryFn: async ({ signal }) => {
          const res = await fetch(url, { ...reqInit, signal });
          if (res.ok) {
            const data = await res.json();
            if (param.query) return data?.rowData;
            return data;
          }
          throw new Error(res.statusText);
        },
        enabled,
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 60,
      } as UseQueryOptions<(TSelectValues | string)[]>;
    });

    return { queries };
  }, [
    endpointParams,
    widget.endpoint?.headers,
    state.localParams,
    widget.refreshQuery,
  ]);

  const endpointQueries = useQueries(queriesMemo);
  const isFirstRender = useIsFirstRender();

  useEffect(() => {
    if (isFirstRender) return;
    queueMicrotask(() => {
      for (const query of endpointQueries) {
        if (query.isLoading || query.isFetching) continue;
        query.refetch();
      }
    });
  }, [widget.refreshQuery]);

  const endpointOptions = useMemo(() => {
    const paramKeys = Object.keys(endpointParams);
    return endpointQueries.reduce(
      (acc, query, idx) => {
        if (query.isLoading) return acc;
        const key = paramKeys[idx];
        if (query.isError) {
          console.error("Failed to fetch endpoint options", query.error);

          acc[key] = ["Failed to fetch options"];
          return acc;
        }

        invalidResponseRef.current[key] = false;
        acc[key] = query.data;

        return acc;
      },
      {} as Record<string, (TSelectValues | string)[]>,
    );
  }, [endpointQueries, endpointParams, invalidResponseRef]);

  useEffect(() => {
    if (!(widget.external || tickerParamDef)) return;

    const tickerParam = tickerParamDef?.paramName;
    if (params[tickerParam] !== widget.data?.mainTicker?.symbol) {
      const newSymbol = widget.data?.mainTicker?.symbol;
      updateParams(tickerParam, newSymbol, widget.data?.mainTicker);
    }
  }, [widget.data?.mainTicker?.symbol]);

  useEventListener(`runParams-${widget?.id}`, () => widget.runButton && syncParams());

  useEventListener(`updateQueryParams-${widget?.id}`, (newParams: ParamsT) => {
    if (!(Object.keys(newParams || {}).length && hasParams)) return;
    queueMicrotask(() => {
      dispatch({
        localParams: (prev) => {
          const nextLocalParams = { ...prev, ...newParams };
          if (widget.runButton) {
            const params = currentParamsRef.current;
            queueMicrotask(() => syncCopilotParamsState(nextLocalParams, params));
          }
          return nextLocalParams;
        },
      });
    });
  });

  const { rowElements, tabRowElements } = useMemo(() => {
    const rowElements = Object.values(paramsGroupedByRow).map((rowParams, index) => {
      if (!rowParams?.length) return null;

      const element = (
        <RenderParamsForRow
          key={`param-row-${index}-render`}
          rowParams={rowParams}
          state={state}
          updateParams={updateParams}
          endpointOptions={endpointOptions}
          endpointParams={endpointParams}
          invalidResponseRef={invalidResponseRef}
          isExternal={widget.external}
          sqlParamNames={sqlParamNames}
          showSqlParamLabels={sqlEditorFocused}
        />
      );
      if (index === 0) return element;

      return (
        <div
          key={`param-row-${index}`}
          className="flex gap-1.5 mx-2.5 pb-1 overflow-y-hidden overflow-x-auto h-[22px] text-2xs"
        >
          {element}
        </div>
      );
    });

    const tabRowElements =
      tabsParams.length > 0 ? (
        <RenderTabParamsRow
          tabsParams={tabsParams}
          state={state}
          updateParams={updateParams}
        />
      ) : null;

    return { rowElements, tabRowElements };
  }, [
    paramsGroupedByRow,
    state,
    endpointOptions,
    updateParams,
    endpointParams,
    tabsParams,
    invalidResponseRef,
    sqlParamNames,
    sqlEditorFocused,
  ]);

  // Return the row 0 parameters to be used in elementRightNextToTitle
  return useMemo(() => {
    const [row0, ...rowsBelow] = rowElements;

    const hasTicker = widget?.data?.mainTicker && tickerParamDef?.show;

    const renderRow0Params = (
      <div
        data-widget-param-row="0"
        className="flex gap-1.5 _elements-left-navbar
        min-w-fit items-center h-[22px] text-2xs"
      >
        {hasTicker && (
          <AdvancedSelectedTicker
            triggerSize="sm"
            ticker={widget.data?.mainTicker}
            setTicker={(ticker) => {
              const symbol = ticker?.symbol || ticker;
              const tickerParam = tickerParamDef?.paramName ?? "symbol";
              updateParams(tickerParam, symbol, ticker);
            }}
          />
        )}
        {hasForm && <FormParamDialog />}
        {row0}
      </div>
    );

    // Render tabs params in their own row below the navbar
    const renderTabsRow = tabRowElements ? (
      <div className="flex items-center gap-2 px-2.5 py-1">{tabRowElements}</div>
    ) : null;

    const filteredRowsBelow = rowsBelow.filter(Boolean);
    const hasRowsBelow = filteredRowsBelow.length > 0 || renderTabsRow;

    if (!someTruthy(hasTicker, row0, hasRowsBelow, hasForm))
      return { renderRow0Params: null, renderBelowNavbarRows: null };

    if (!hasRowsBelow) return { renderRow0Params, renderBelowNavbarRows: null };

    const renderBelowNavbarRows = (
      <div className="flex flex-col gap-1 my-1">
        {filteredRowsBelow}
        {renderTabsRow}
      </div>
    );

    return { renderRow0Params, renderBelowNavbarRows };
  }, [
    tickerParamDef,
    widget.data?.mainTicker,
    rowElements,
    tabRowElements,
    syncParamsRef,
    updateParams,
  ]);
}

const RenderTabParamsRow = memo(
  (props: {
    tabsParams: ParamDefT<"tabs">[];
    state: ParamsStateT;
    updateParams: (key: string, value: any, mainTicker?: Ticker) => void;
  }) => {
    const { tabsParams, state, updateParams } = props;
    return tabsParams.map((param, index) => {
      const { paramName, label, options } = param;
      const localValue = state.localParams?.[paramName] ?? param.value;

      const title = label ?? paramName;
      const toolTipMessage = (
        <div className="max-w-[296px]">
          <div className="flex justify-between gap-2">
            <div className="body-sm-bold break-words line-clamp-2">{title}</div>
          </div>
          {typeof param.description === "string" && (
            <div className="body-xs-regular pt-2 break-words max-h-[296px] overflow-y-auto">
              {param.description}
            </div>
          )}
        </div>
      );

      return (
        <TabsParam
          key={`tabs-param-${index}`}
          value={localValue}
          options={options}
          onValueChange={(value) => updateParams(paramName, value)}
          toolTipMessage={toolTipMessage}
        />
      );
    });
  },
);

export const RenderParamsForRow = memo(
  (props: {
    rowParams: ParamDef[];
    state: ParamsStateT;
    updateParams: (key: string, value: any, mainTicker?: Ticker) => void;
    endpointParams?: Record<string, ParamDefT<"endpoint">>;
    endpointOptions?: Record<string, (TSelectValues | string)[]>;
    invalidResponseRef: MutableRefObject<Record<string, boolean>>;
    isExternal?: boolean;
    sqlParamNames?: Set<string>;
    showSqlParamLabels?: boolean;
  }) => {
    const {
      rowParams,
      state,
      updateParams,
      endpointOptions,
      endpointParams,
      invalidResponseRef,
      isExternal = false,
      sqlParamNames,
      showSqlParamLabels = false,
    } = props;

    const withLabel = (node: ReactNode, param: ParamDef): ReactNode => {
      if (!(showSqlParamLabels && sqlParamNames?.has(param.paramName))) return node;
      const labelText = param.label || beautifySlug(param.paramName);
      return (
        <div
          key={`${param.paramName}-${param.row}-labeled`}
          className="flex items-center gap-1 shrink-0"
        >
          <span
            className="body-2xs-regular text-ds-text-caption
            whitespace-nowrap uppercase tracking-wider"
          >
            {labelText}
          </span>
          {node}
        </div>
      );
    };

    return rowParams.map((param) => {
      const {
        paramName,
        label,
        options: defaultOptions,
        description = [],
        multiSelect = false,
      } = param;

      const localValue = state.localParams?.[paramName] ?? param.value;

      if (!param.show) {
        return (
          <GroupDropdown
            className=""
            paramDef={param}
            key={`${paramName}-${param.row}`}
          />
        );
      }

      const title = label ?? paramName;
      let options = defaultOptions;

      const toolTipMessage = (
        <div className="max-w-[296px]">
          <div className="flex justify-between gap-2">
            <div className="body-sm-bold break-words line-clamp-2">{title}</div>
          </div>
          {typeof description === "string" && (
            <div className="body-xs-regular pt-2 break-words max-h-[296px] overflow-y-auto">
              {description.split(/\n|\\\n/).map((line, idx) => {
                // Count leading spaces for indentation
                const spaces = line.match(/^ */)[0].length;
                return (
                  <div
                    key={`${paramName}-desc-${idx}`}
                    className={cn(`pl-${Math.min(6, spaces)}`)}
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
      if (param.type === "boolean" && options?.length === 2) {
        const stringParam = state.localParams?.[paramName]?.toString();
        return withLabel(
          <GroupDropdown
            className="obb-parameter pr-0.5"
            type="param"
            paramDef={param}
            key={`${paramName}-${param.row}`}
          >
            <ToggleSelect
              className="w-fit min-w-[96px]"
              label={beautifySlug(title)}
              selected={stringParam?.toLowerCase() === "true"}
              onSelect={(selected) =>
                updateParams(paramName, selected ? "true" : "false")
              }
              values={[
                { label: "On", value: true },
                { label: "Off", value: false },
              ]}
              toolTipMessage={toolTipMessage}
            />
          </GroupDropdown>,
          param,
        );
      }

      if (param.type === "date") {
        return withLabel(
          <GroupDropdown
            className="obb-parameter pr-0.5"
            type="param"
            paramDef={param}
            key={`${paramName}-${param.row}`}
          >
            <SingleDatePicker
              triggerClassName=""
              key={`${paramName}-${param.row}-tooltip`}
              defaultDate={localValue as string}
              onSave={(date) => {
                const formattedDate = date ? date : "";
                updateParams(paramName, formattedDate);
              }}
              toolTipProps={{
                message: toolTipMessage,
                position: "top",
              }}
            />
          </GroupDropdown>,
          param,
        );
      }

      let forceExtraInfo = false;
      if (param.type === "endpoint") {
        const isSQLParam = !!endpointParams?.[paramName]?.query;
        let paramOptions = endpointOptions[paramName] ?? ["Loading..."];
        if (!Array.isArray(paramOptions)) {
          const showWarning = !invalidResponseRef.current[paramName];

          if (showWarning) {
            const cleanUrl = endpointParams[paramName].optionsEndpoint.split("/").pop();
            toast.warning("Invalid response for endpoint params.", {
              id: `invalid-endpoint-${cleanUrl}`,
              description: (
                <>
                  Invalid endpoint options structure for{" "}
                  <span className="font-bold">{cleanUrl}</span>.
                  <div className="pt-2">
                    <strong>Expected array of:</strong>
                    <br />
                    <div className="text-xs pl-4">
                      Strings or Objects with <strong>label</strong> and{" "}
                      <strong>value</strong> properties.
                    </div>
                  </div>
                </>
              ),
            });

            invalidResponseRef.current[paramName] = true;
          }
          paramOptions = ["Invalid endpoint options"];
        }
        options = paramOptions
          .map((option: TSelectValues | string) => {
            if (Array.isArray(option)) return null;

            if (typeof option !== "object") {
              const label = option?.toString();
              return { label, value: option };
            }

            if (option) {
              if (option?.label && option?.value) return option;

              const lowerOption = Object.fromEntries(
                Object.entries(option).map(([key, value]) => [
                  key.toLowerCase(),
                  value,
                ]),
              ) as TSelectValues;

              if (lowerOption?.label && lowerOption?.value) return lowerOption;

              if (isSQLParam) {
                const keys = Object.keys(option);
                if (keys.length === 1) {
                  const value = option[keys[0]];
                  // Surface null/empty values with a clear sentinel label so the
                  // row isn't confused with a real value.
                  const label =
                    value === null || value === undefined || value === ""
                      ? "No value"
                      : value.toString();
                  return { label, value };
                }
              }
            }

            return null;
          })
          .filter(Boolean)
          // Float null/empty rows to the top so they don't sit awkwardly
          // between real values.
          .sort((a: TSelectValues, b: TSelectValues) => {
            const aEmpty = a.value === null || a.value === undefined || a.value === "";
            const bEmpty = b.value === null || b.value === undefined || b.value === "";
            if (aEmpty === bEmpty) return 0;
            return aEmpty ? -1 : 1;
          });

        forceExtraInfo = options.some((o: TSelectValues) => o?.extraInfo);
      }

      if (param.multiple) {
        return withLabel(
          <GroupDropdown
            paramDef={param}
            type="param"
            key={`${paramName}-${param.row}`}
          >
            <CompareTermsParam
              className=""
              toolTipMessage={toolTipMessage}
              selectedLabel={param.label ?? paramName}
              popupWidth={param.style?.popupWidth}
              value={localValue ?? ""}
              onUpdateParam={(val) => updateParams(paramName, val)}
            />
          </GroupDropdown>,
          param,
        );
      }

      if (options?.length > 0) {
        const selectedLabel =
          options.find((o) => o.value === localValue)?.label ?? title;
        const selectedValue = multiSelect ? ensureArray(localValue) : localValue;
        return withLabel(
          <GroupDropdown
            paramDef={param}
            type={param.type === "endpoint" ? "endpointParam" : "param"}
            key={`${paramName}-${param.row}`}
          >
            <AdvancedSelect
              className=""
              popupWidth={param.style?.popupWidth}
              key={`${paramName}-${param.row}`}
              label={
                multiSelect ? (selectedValue.length > 0 ? title : "") : selectedLabel
              }
              selected={selectedValue}
              onSelect={(option) =>
                updateParams(paramName, replaceFailed(option, localValue))
              }
              values={options}
              toolTipMessage={toolTipMessage}
              forceSearch={param.type === "endpoint" || options.length > 10}
              forceExtraInfo={forceExtraInfo}
            />
          </GroupDropdown>,
          param,
        );
      }

      return withLabel(
        <GroupDropdown type="param" paramDef={param} key={`${paramName}-${param.row}`}>
          <DebouncedInput
            key={`${paramName}-${param.row}-input`}
            type={param.type}
            className={cn(
              "obb-minimal-input bg-transparent dark:bg-transparent px-0 h-[18.8px]! border-none!",
              param.type !== "number" &&
                param.type !== "text" &&
                "w-[96px] min-w-[96px]",
            )}
            placeholder={label ?? paramName}
            value={localValue as string}
            debounce={1250}
            onChange={(value) => updateParams(paramName, value)}
            sizeToContent={
              isExternal || param.type === "number" || param.type === "text"
            }
            toolTipProps={{
              message: toolTipMessage,
              position: "top",
            }}
          />
        </GroupDropdown>,
        param,
      );
    });
  },
);

const PERIOD_LABELS = { annual: "FY", quarter: "QTR", ttm: "TTM" } as const;

export function PeriodParams(props?: { paramName?: string }) {
  const {
    widget: {
      external,
      storage: { selectedGroup, params: storageParams, ...storage } = {},
    } = {},
    updateWidget,
    widgetFromJSON,
  } = useWidgetContext();

  const paramName = props?.paramName ?? "period";
  const params: ParamsT = storage?.[selectedGroup] ?? storageParams;

  const { periodOptions, hasPeriod } = useMemo(() => {
    if (!external) {
      const periodParamDef = widgetFromJSON?.params?.find(
        (param) => param.paramName === paramName,
      );

      if (periodParamDef?.options?.length) {
        // If param is visible, useWidgetParamsPositions handles rendering
        if (periodParamDef.show !== false)
          return { periodOptions: [], hasPeriod: false };

        const periodOptions = periodParamDef.options.map(
          // Options union has heterogeneous `value` shapes (string | number
          // | boolean) across param types; explicit any avoids reworking
          // ParamDef types for a read-only map.
          (option: any) => option.value,
        );
        return { periodOptions: periodOptions, hasPeriod: true };
      }
    }

    const hasPeriod = !!widgetFromJSON?.data?.table?.period;
    const periodOptions =
      typeof widgetFromJSON?.data?.table?.period !== "boolean"
        ? widgetFromJSON?.data?.table?.period
        : ["annual", "quarter"];

    return { periodOptions, hasPeriod };
  }, []);

  const updateParams = useCallback(
    (value: any) => {
      updateWidget((prev) => {
        const newWidget = { ...prev };

        newWidget.storage = {
          ...newWidget.storage,
          period: value,
          params: {
            ...(newWidget?.storage?.params ?? {}),
            period: value,
            [paramName]: value,
          },
        };

        return newWidget;
      });
    },
    [updateWidget, selectedGroup],
  );

  const elementMemo = useMemo(() => {
    if (!hasPeriod) return null;

    return (
      <GroupDropdown type="param" groupById="period">
        <ToggleGroupPrimitive.Root
          type="single"
          value={params?.[paramName] ?? "annual"}
          onValueChange={(value) => value && updateParams(value.toLowerCase())}
          className="obb-toggle-group-minimal"
        >
          {periodOptions.map((value) => (
            <ToggleGroupPrimitive.Item
              key={`period-${value}`}
              value={value?.toLowerCase()}
              className="obb-toggle-group-minimal-item"
            >
              {PERIOD_LABELS[value?.toLowerCase()]}
            </ToggleGroupPrimitive.Item>
          ))}
        </ToggleGroupPrimitive.Root>
      </GroupDropdown>
    );
  }, [params?.[paramName], periodOptions, hasPeriod, updateParams]);

  return elementMemo;
}
