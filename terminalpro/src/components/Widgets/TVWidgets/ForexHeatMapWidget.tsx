import { memo, useCallback, useMemo } from "react";
import { ForexHeatMap } from "react-ts-tradingview-widgets";
import DraggableCard from "~/components/DraggableCard";
import SetLoadingOnResize from "~/components/DraggableCard/SetLoadingOnResize";
import NewAdvancedSelectAddEdit from "~/components/NewAdvancedSelectAddEdit";
import { useWidgetContext } from "~/components/Widget.context";
import { useShallowThemeStore } from "~/lib/state/theme";

const TradingViewWidget = memo(function TradingViewWidget() {
  const theme = useShallowThemeStore((state) => state.theme);
  const { widget, updateWidget } = useWidgetContext();

  const availableCurrencies = useMemo(
    () =>
      widget.storage?.availableCurrencies || [
        { label: "EUR", value: "EUR" },
        { label: "USD", value: "USD" },
        { label: "JPY", value: "JPY" },
        { label: "GBP", value: "GBP" },
        { label: "CHF", value: "CHF" },
        { label: "AUD", value: "AUD" },
        { label: "CAD", value: "CAD" },
        { label: "NZD", value: "NZD" },
        { label: "CNY", value: "CNY" },
      ],
    [widget.storage?.availableCurrencies],
  );

  const handleSelect = useCallback((_val: string) => {
    // This function is not used for selection in this widget
  }, []);

  const handleRemove = useCallback(
    (val: string) => {
      const updatedCurrencies = availableCurrencies.filter(
        (currency) => currency.value !== val,
      );
      updateWidget((prevWidget) => ({
        ...prevWidget,
        storage: {
          ...prevWidget.storage,
          availableCurrencies: updatedCurrencies,
        },
      }));
    },
    [availableCurrencies, updateWidget],
  );

  const handleAdd = useCallback(
    (newCurrency: { label: string; value: string }) => {
      updateWidget((prevWidget) => ({
        ...prevWidget,
        storage: {
          ...prevWidget.storage,
          availableCurrencies: [
            ...(prevWidget.storage?.availableCurrencies || []),
            newCurrency,
          ],
        },
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
        <NewAdvancedSelectAddEdit
          label="Currencies"
          onSelect={handleSelect}
          onRemove={handleRemove}
          onAdd={handleAdd}
          values={availableCurrencies}
          allowSelection={false}
          selectionListType="Currencies"
        />
      }
    >
      <SetLoadingOnResize>
        <ForexHeatMap
          colorTheme={theme === "dark" ? "dark" : "light"}
          autosize={true}
          width="100%"
          copyrightStyles={{
            parent: {
              display: "none",
            },
          }}
          currencies={availableCurrencies.map((currency) => currency.value)}
        />
      </SetLoadingOnResize>
    </DraggableCard>
  );
});

export default TradingViewWidget;
