import dayjs from "dayjs";
import { useCallback, useMemo, useRef, useState } from "react";
import DecimalDigitsRadio from "~/components/DecimalDigitsRadio";
import DraggableCard from "~/components/DraggableCard";
import { getContextMenuItems } from "~/components/General/Table/AgGridUtils";
import { AgGridProvider } from "~/components/General/Table/hooks";
import Icon from "~/components/Icon";
import { AdvancedSelect } from "~/components/NewAdvancedSelect";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useProGroupedComparisons } from "~/lib/api/sdkComponents";
import { useShallowThemeStore } from "~/lib/state/theme";
import AdvancedSelectedTickers from "../../Helpers/AdvancedSelectedTickers";
import AdvancedSelectedTicker, {
  resultsToTicker,
} from "../../Helpers/AdvancedSelectTicker";
import useCopilotDataWidget from "../../Helpers/useCopilotDataWidget";
import { COMPARISON_TYPES, FINANCIAL_RATIOS } from "./constants";
import { prepareColumnDefs, usePeersData } from "./hooks/usePeersData";
import type { Selected } from "./types";

export default function GroupedComparison() {
  const { widget, updateWidget } = useWidgetContext();

  const [state, dispatch] = useStateReducer({
    additionalPeers: widget.data?.secondaryTickers?.map((t) => t.symbol) ?? [],
    availableTickers: widget.data?.secondaryTickers ?? [],
  });
  const additionalPeersRef = useRef<string[]>(state.additionalPeers);

  const decimalDigits = useShallowThemeStore((state) => state.decimalDigits);
  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const selected = {
    interval: widget.storage?.params?.period || "annual",
    quarter: widget.storage?.params?.quarter || "FY",
    year: widget.storage?.params?.year || dayjs().year(),
    group: widget.storage?.selectedGroup || "valuation_multiples",
    ratio: widget.storage?.selectedRatio || "liquidity",
  } as Selected;

  usePeersData(state.availableTickers, additionalPeersRef, dispatch);

  const { data, ...peersQuery } = useProGroupedComparisons(
    {
      queryParams: {
        symbol: state.additionalPeers?.join(","),
      },
    },
    {
      enabled: state.additionalPeers?.length > 0,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    },
  );

  const currentData = data?.results;

  const possibleYears = Array.from(
    new Set(
      currentData?.available?.[selected.group]?.filter((t) =>
        t.periods?.includes(selected.quarter),
      ),
    ),
  ).map((t) => t.calendar_year);

  const workingYear = possibleYears?.includes(selected.year)
    ? selected.year
    : possibleYears[0];

  const tableData = useMemo(() => {
    return (
      currentData?.[selected.group]?.filter(
        (t) =>
          (t?.fiscal_year === workingYear && t.fiscal_period === selected.quarter) ||
          (t.fiscal_period === "TTM" && selected.quarter === "TTM"),
      ) || null
    );
  }, [
    currentData,
    currentData?.[selected.group],
    selected.group,
    selected.quarter,
    workingYear,
  ]);

  const columnDefs = useMemo(() => {
    return prepareColumnDefs({ ...selected, decimalDigitsToUse });
  }, [selected.group, selected.ratio, decimalDigitsToUse]);

  const contextMenuItems = useCallback(
    (params) => getContextMenuItems(params, { widgetId: widget?.id }),
    [],
  );

  const availableTickers = useMemo(() => {
    const tickers =
      currentData?.tickers?.length > 0
        ? resultsToTicker(currentData?.tickers)
        : state.availableTickers;

    return tickers?.filter(
      (t) =>
        t.symbol !== widget.data?.mainTicker?.symbol &&
        state.additionalPeers?.includes(t.symbol),
    );
  }, [currentData?.tickers, state, widget.data?.mainTicker?.symbol]);

  useCopilotDataWidget({
    aiData: tableData,
    aiEnabled: true,
    lastUpdated: peersQuery.dataUpdatedAt,
  });

  return (
    <DraggableCard
      aiData={true}
      aiEnabled={true}
      extraClassName="h-[calc(100%-50px)]"
      showActionsSettings={true}
      onSaveSettings={() => {
        updateWidget((prev) => ({
          ...prev,
          storage: {
            ...prev.storage,
            decimalDigits: decimalDigitsSettings,
          },
        }));
      }}
      settingsModalChildren={
        <DecimalDigitsRadio
          decimalDigits={decimalDigitsSettings}
          setDecimalDigits={setDecimalDigitsSettings}
        />
      }
      elementRightNextToTitle={
        <>
          <AdvancedSelectedTicker
            triggerSize="sm"
            setTicker={(ticker) => {
              updateWidget((prev) => ({
                ...prev,
                data: {
                  ...prev.data,
                  mainTicker: ticker,
                  secondaryTickers: [],
                },
                storage: {
                  ...(prev?.storage || {}),
                  params: { ...(prev?.storage?.params ?? {}), symbol: ticker.symbol },
                },
              }));
            }}
          />
          <AdvancedSelectedTickers
            triggerInside={
              <>
                <Icon id="plus-icon" className="h-2.5 w-2.5" />
                <span className="whitespace-nowrap text-xs">Add Additional Ticker</span>
              </>
            }
            tickers={availableTickers}
            setTickers={(newTickers, _mainTicker) => {
              updateWidget((prev) => {
                const tickers = [_mainTicker, ...(newTickers || [])];
                const additionalPeers = Array.from(
                  new Set(newTickers.map((t) => t.symbol)),
                );
                additionalPeersRef.current = additionalPeers;

                dispatch({ additionalPeers, availableTickers: tickers });

                return {
                  ...prev,
                  data: {
                    ...prev.data,
                    secondaryTickers: tickers,
                  },
                  storage: {
                    ...(prev?.storage || {}),
                    params: {
                      ...(prev?.storage?.params ?? {}),
                      symbol: tickers.map((t) => t.symbol).join(","),
                    },
                  },
                };
              });
            }}
            triggerSize="sm"
          />
        </>
      }
      elementNextToTitle={
        <QuarterYearSelects
          selected={selected}
          workingYear={workingYear}
          possibleYears={possibleYears}
          updateWidget={updateWidget}
        />
      }
      elementBelowNavbar={
        <div className="flex flex-col gap-1 mt-0.5 mb-1">
          <div className="flex gap-1.5 px-2.5 pb-1 overflow-y-hidden overflow-x-auto h-[22px] text-2xs">
            <AdvancedSelect
              className="obb-parameter"
              popupWidth={200}
              label={
                COMPARISON_TYPES.find((t) => t.value === selected.group)?.label ??
                "Group"
              }
              selected={selected.group}
              onSelect={(value) => {
                if (!value) return;
                updateWidget((prev) => ({
                  ...prev,
                  storage: {
                    ...prev.storage,
                    selectedGroup: String(value),
                    params: {
                      ...(prev?.storage?.params ?? {}),
                      selectedGroup: String(value),
                    },
                  },
                }));
              }}
              values={COMPARISON_TYPES as unknown as { label: string; value: string }[]}
            />
            {selected.group === "financial_ratios" && (
              <AdvancedSelect
                className="obb-parameter"
                popupWidth={200}
                label={
                  FINANCIAL_RATIOS.find((r) => r.value === selected.ratio)?.label ??
                  "Ratio"
                }
                selected={selected.ratio}
                onSelect={(value) => {
                  if (!value) return;
                  updateWidget((prev) => ({
                    ...prev,
                    storage: {
                      ...prev.storage,
                      selectedRatio: String(value),
                    },
                  }));
                }}
                values={
                  FINANCIAL_RATIOS as unknown as { label: string; value: string }[]
                }
              />
            )}
          </div>
        </div>
      }
      lastUpdated={peersQuery.dataUpdatedAt}
      loading={peersQuery.isLoading}
      error={peersQuery.error}
    >
      <div className="flex grow h-full">
        <AgGridProvider
          rowData={tableData}
          getContextMenuItems={contextMenuItems}
          columnDefs={columnDefs}
          rowHeight={36}
        />
      </div>
    </DraggableCard>
  );
}

const QUARTER_OPTIONS = [
  { label: "FY", value: "FY" },
  { label: "Q1", value: "Q1" },
  { label: "Q2", value: "Q2" },
  { label: "Q3", value: "Q3" },
  { label: "Q4", value: "Q4" },
  { label: "TTM", value: "TTM" },
];

function QuarterYearSelects({
  selected,
  workingYear,
  possibleYears,
  updateWidget,
}: {
  selected: Selected;
  workingYear: number;
  possibleYears: number[];
  updateWidget: ReturnType<typeof useWidgetContext>["updateWidget"];
}) {
  const quarterValue = useMemo(() => {
    return [selected.quarter, selected.interval].some((v) =>
      ["TTM", "quarter"].includes(v),
    )
      ? selected.quarter
      : "FY";
  }, [selected.quarter, selected.interval]);

  const yearOptions = useMemo(
    () =>
      [...possibleYears]
        .sort((a, b) => b - a)
        .map((year) => ({ label: year.toString(), value: year })),
    [possibleYears],
  );

  return (
    <>
      {yearOptions.length > 0 && (
        <AdvancedSelect
          className="obb-parameter"
          popupWidth={100}
          label={workingYear ? workingYear.toString() : "Year"}
          selected={workingYear || undefined}
          onSelect={(year) =>
            updateWidget((prev) => ({
              ...prev,
              storage: {
                ...prev.storage,
                params: {
                  ...(prev?.storage?.params ?? {}),
                  year: Number(year),
                },
              },
            }))
          }
          values={yearOptions}
        />
      )}
      <AdvancedSelect
        className="obb-parameter"
        popupWidth={100}
        label={quarterValue}
        selected={quarterValue}
        onSelect={(value) => {
          if (!value) return;
          const strValue = String(value);
          let period = strValue.toLowerCase();
          if (strValue !== "TTM") {
            period = strValue === "FY" ? "annual" : "quarter";
          }
          updateWidget((prev) => ({
            ...prev,
            storage: {
              ...prev.storage,
              params: {
                ...(prev?.storage?.params ?? {}),
                period,
                quarter: strValue,
              },
            },
          }));
        }}
        values={QUARTER_OPTIONS}
      />
    </>
  );
}
