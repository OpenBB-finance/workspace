import { memo } from "react";
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";
import DraggableCard from "~/components/DraggableCard";
import SetLoadingOnResize from "~/components/DraggableCard/SetLoadingOnResize";
import { useShallowThemeStore } from "~/lib/state/theme";

const TradingViewWidget = memo(function TradingViewWidget() {
  const theme = useShallowThemeStore((state) => state.theme);

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
    <DraggableCard settings={dropdownSettings}>
      <SetLoadingOnResize>
        <AdvancedRealTimeChart
          theme={theme as "light" | "dark"}
          autosize={true}
          symbol="NASDAQ:AAPL"
          interval="D"
          timezone="Etc/UTC"
          style="1"
          locale="en"
          withdateranges={true}
          hide_side_toolbar={false}
          allow_symbol_change={true}
        />
      </SetLoadingOnResize>
    </DraggableCard>
  );
});

export default TradingViewWidget;
