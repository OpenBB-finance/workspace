import { memo, useCallback, useMemo, useState } from "react";
import { CompanyProfile } from "react-ts-tradingview-widgets";
import { useDebounce } from "use-debounce";
import DraggableCard from "~/components/DraggableCard";
import SetLoadingOnResize from "~/components/DraggableCard/SetLoadingOnResize";
import NewAdvancedSelectAddEdit from "~/components/NewAdvancedSelectAddEdit";
import { useWidgetContext } from "~/components/Widget.context";
import { useShallowThemeStore } from "~/lib/state/theme";

const TradingViewWidget = memo(function TradingViewWidget() {
  const theme = useShallowThemeStore((state) => state.theme);
  const { widget, updateWidget } = useWidgetContext();

  const availableSymbols = useMemo(
    () =>
      widget.storage?.availableSymbols || [
        { label: "AAPL", value: "AAPL" },
        { label: "SPY", value: "SPY" },
        { label: "BTCUSD", value: "BTCUSD" },
        { label: "EURUSD", value: "EURUSD" },
        { label: "Gold", value: "Gold" },
      ],
    [widget.storage?.availableSymbols],
  );

  const [selectedSymbol, setSelectedSymbol] = useState(
    widget.storage?.selectedSymbol || availableSymbols[0]?.value || "",
  );
  const [debouncedSymbol] = useDebounce(selectedSymbol, 500);

  const handleSelect = useCallback((val: string) => {
    setSelectedSymbol(val);
    updateWidget((prevWidget) => ({
      ...prevWidget,
      storage: { ...prevWidget.storage, selectedSymbol: val },
    }));
  }, []);

  const handleRemove = useCallback(
    (val: string) => {
      const updatedSymbols = availableSymbols.filter((item) => item.value !== val);
      if (selectedSymbol === val) {
        setSelectedSymbol(updatedSymbols[0]?.value || "");
        updateWidget((prevWidget) => ({
          ...prevWidget,
          storage: {
            ...prevWidget.storage,
            availableSymbols: updatedSymbols,
            selectedSymbol: updatedSymbols[0]?.value,
          },
        }));
      } else {
        updateWidget((prevWidget) => ({
          ...prevWidget,
          storage: { ...prevWidget.storage, availableSymbols: updatedSymbols },
        }));
      }
    },
    [selectedSymbol, availableSymbols, updateWidget],
  );

  const handleAdd = useCallback(
    (newSymbol) => {
      const updatedSymbols = [...availableSymbols, newSymbol];
      updateWidget((prevWidget) => ({
        ...prevWidget,
        storage: {
          ...prevWidget.storage,
          availableSymbols: updatedSymbols,
          selectedSymbol: newSymbol.value,
        },
      }));
      setSelectedSymbol(newSymbol.value);
    },
    [availableSymbols, updateWidget],
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
        <NewAdvancedSelectAddEdit
          selected={selectedSymbol}
          label={selectedSymbol}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onAdd={handleAdd}
          values={widget.storage?.availableSymbols || availableSymbols}
        />
      }
    >
      <SetLoadingOnResize>
        <CompanyProfile
          autosize={true}
          colorTheme={theme === "dark" ? "dark" : "light"}
          height={400}
          width="100%"
          copyrightStyles={{
            parent: {
              display: "none",
            },
          }}
          symbol={debouncedSymbol}
        />
      </SetLoadingOnResize>
    </DraggableCard>
  );
});

export default TradingViewWidget;
