import { memo, useCallback, useMemo, useState } from "react";
import { Timeline } from "react-ts-tradingview-widgets";
import { useDebounce } from "use-debounce";
import DraggableCard from "~/components/DraggableCard";
import SetLoadingOnResize from "~/components/DraggableCard/SetLoadingOnResize";
import NewAdvancedSelect from "~/components/NewAdvancedSelect";
import { useWidgetContext } from "~/components/Widget.context";
import { useShallowThemeStore } from "~/lib/state/theme";

const TradingViewWidget = memo(function TradingViewWidget() {
  const theme = useShallowThemeStore((state) => state.theme);
  const { widget, updateWidget } = useWidgetContext();

  const availableMarkets = useMemo(
    () => [
      { label: "All", value: "All" },
      { label: "Crypto", value: "Crypto" },
      { label: "Forex", value: "Forex" },
      { label: "Stock", value: "Stock" },
      { label: "Index", value: "Index" },
      { label: "Futures", value: "Futures" },
    ],
    [],
  );

  const [market, setMarket] = useState(widget.storage?.selectedMarket || "All");
  const [debouncedMarket] = useDebounce(market, 500);

  const handleMarketSelect = useCallback(
    (val: string) => {
      setMarket(val);
      updateWidget((prevWidget) => ({
        ...prevWidget,
        storage: { ...prevWidget.storage, selectedMarket: val },
      }));
    },
    [updateWidget],
  );

  const dropdownSettings = {
    showSettings: false,
    showFunctions: false,
    showShare: false,
    showDuplicate: false,
    showExport: false,
    showMaximize: false,
    showMove: true,
  };

  return (
    <DraggableCard
      settings={dropdownSettings}
      elementNextToTitle={
        <NewAdvancedSelect
          selected={market}
          label={market}
          onSelect={handleMarketSelect}
          values={availableMarkets}
        />
      }
    >
      <SetLoadingOnResize>
        {/* @ts-expect-error */}
        <Timeline
          autosize={true}
          colorTheme={theme === "dark" ? "dark" : "light"}
          height={400}
          width="100%"
          copyrightStyles={{
            parent: {
              display: "none",
            },
          }}
          displayMode="adaptive"
          feedMode={debouncedMarket === "All" ? "all_symbols" : "market"}
          market={debouncedMarket.toLowerCase()}
        />
      </SetLoadingOnResize>
    </DraggableCard>
  );
});

export default TradingViewWidget;
