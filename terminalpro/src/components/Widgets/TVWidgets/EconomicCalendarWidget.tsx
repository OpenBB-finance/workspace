import { memo } from "react";
import { EconomicCalendar } from "react-ts-tradingview-widgets";
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
        <EconomicCalendar
          autosize={true}
          colorTheme={theme === "dark" ? "dark" : "light"}
          height={400}
          width="100%"
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
