import { memo, useCallback, useMemo, useState } from "react";
import { Ticker } from "react-ts-tradingview-widgets";
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
        { label: "SP500", value: "SP500" },
        { label: "NASDAQ100", value: "NASDAQ100" },
        { label: "EUR/USD", value: "EUR/USD" },
        { label: "BTC/USD", value: "BTC/USD" },
        { label: "ETH/USD", value: "ETH/USD" },
      ],
    [widget.storage?.availableSymbols],
  );

  const [selectedSymbol, setSelectedSymbol] = useState(
    widget.storage?.selectedSymbol || availableSymbols[0]?.value || "",
  );

  const handleSelect = useCallback(
    (val: string) => {
      setSelectedSymbol(val);
      updateWidget((prevWidget) => ({
        ...prevWidget,
        storage: { ...prevWidget.storage, selectedSymbol: val },
      }));
    },
    [updateWidget],
  );

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
          label={selectedSymbol}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onAdd={handleAdd}
          values={widget.storage?.availableSymbols || availableSymbols}
          allowSelection={false}
          selectionListType="Symbols"
        />
      }
    >
      <SetLoadingOnResize>
        <Ticker
          colorTheme={theme === "dark" ? "dark" : "light"}
          copyrightStyles={{
            parent: {
              display: "none",
            },
          }}
          symbols={availableSymbols.map((symbol) => ({
            proName: symbol.value,
            title: symbol.label,
          }))}
        />
      </SetLoadingOnResize>
    </DraggableCard>
  );
});

export default TradingViewWidget;
