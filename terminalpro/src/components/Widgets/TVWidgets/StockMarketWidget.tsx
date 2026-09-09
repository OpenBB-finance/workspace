import { memo, useState } from "react";
import { StockMarket } from "react-ts-tradingview-widgets";
import { useDebounce } from "use-debounce";
import DraggableCard from "~/components/DraggableCard";
import SetLoadingOnResize from "~/components/DraggableCard/SetLoadingOnResize";
import NewAdvancedSelect from "~/components/NewAdvancedSelect";
import { useShallowThemeStore } from "~/lib/state/theme";

const TradingViewWidget = memo(function TradingViewWidget() {
  const theme = useShallowThemeStore((state) => state.theme);
  const [exchange, setExchange] = useState("US");

  const [debouncedExchange] = useDebounce(exchange, 500);

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
          selected={exchange}
          label={exchange}
          onSelect={(val: string) => setExchange(val)}
          values={[
            { label: "US", value: "US" },
            { label: "NASDAQ", value: "NASDAQ" },
            { label: "NYSE", value: "NYSE" },
            { label: "AMEX", value: "AMEX" },
            { label: "OTC", value: "OTC" },
            { label: "ASX", value: "ASX" },
            { label: "CSE", value: "CSE" },
            { label: "NEO", value: "NEO" },
            { label: "TSX", value: "TSX" },
            { label: "TSXV", value: "TSXV" },
            { label: "EGX", value: "EGX" },
            { label: "BER", value: "BER" },
            { label: "DUS", value: "DUS" },
            { label: "FWB", value: "FWB" },
            { label: "SWB", value: "SWB" },
            { label: "HAM", value: "HAM" },
            { label: "HAN", value: "HAN" },
            { label: "XETR", value: "XETR" },
            { label: "BSE", value: "BSE" },
            { label: "NSE", value: "NSE" },
            { label: "TASE", value: "TASE" },
            { label: "MIL", value: "MIL" },
            { label: "LUXSE", value: "LUXSE" },
            { label: "NEWCONNECT", value: "NEWCONNECT" },
            { label: "NGM", value: "NGM" },
            { label: "BIST", value: "BIST" },
            { label: "LSE", value: "LSE" },
            { label: "LSIN", value: "LSIN" },
            { label: "HNX", value: "HNX" },
          ]}
        />
      }
    >
      <SetLoadingOnResize>
        <StockMarket
          autosize={true}
          colorTheme={theme === "dark" ? "dark" : "light"}
          height={400}
          width="100%"
          showFloatingTooltip={true}
          // @ts-expect-error - ignored for now
          exchange={debouncedExchange}
          copyrightStyles={{
            parent: {
              display: "none",
            },
          }}
        />
      </SetLoadingOnResize>
    </DraggableCard>
  );
});

export default TradingViewWidget;
