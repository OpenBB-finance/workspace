import type { CellSelectionChangedEvent } from "ag-grid-community";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import { useWidgetContext } from "~/components/Widget.context";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useAgGridContext } from "../hooks";

const showChartGenerationFF = getConfig().ui.showChartGeneration;

export function useChartGeneration(props?: {
  effectOnMount?: () => void;
  enableCharts?: boolean;
}): {
  handleRangeSelection: (params: CellSelectionChangedEvent) => void;
  ChartGeneration: JSX.Element;
  rangeSelection: CellSelectionChangedEvent;
  enableCharts?: boolean;
} {
  const { effectOnMount } = props || {};
  const { widget, widgetFromJSON } = useWidgetContext();
  const gridRef = useAgGridContext()?.gridRef;
  const showChartGeneration = useShallowThemeStore(
    (state) => state.showChartGeneration,
  );

  const [rangeSelection, setRangeSelection] = useState<CellSelectionChangedEvent>(null);

  const handleRangeSelection = useCallback(
    (params: CellSelectionChangedEvent) => {
      if (params.finished && !params.started) {
        setRangeSelection(params);
      }
    },
    [setRangeSelection],
  );

  const memoizedChartGeneration = useMemo(() => {
    // Chart generation disabled - users can create charts via right-click context menu
    return null;
  }, []);

  useEffect(() => {
    return (): void => {
      if (gridRef.current) {
        setRangeSelection(null);
        effectOnMount?.();
      }
    };
  }, []);

  return {
    handleRangeSelection,
    ChartGeneration: memoizedChartGeneration,
    rangeSelection,
  };
}
