import { memo, useCallback, useMemo, useState } from "react";
import { MarketOverview } from "react-ts-tradingview-widgets";
import DraggableCard from "~/components/DraggableCard";
import SetLoadingOnResize from "~/components/DraggableCard/SetLoadingOnResize";
import NewAdvancedSelectAddEdit from "~/components/NewAdvancedSelectAddEdit";
import { useWidgetContext } from "~/components/Widget.context";
import { useShallowThemeStore } from "~/lib/state/theme";

type AvailableSymbols = Record<string, { label: string; value: string }[]>;

const TradingViewWidget = memo(function TradingViewWidget() {
  const theme = useShallowThemeStore((state) => state.theme);
  const { widget, updateWidget } = useWidgetContext();

  const availableSymbols = useMemo<AvailableSymbols>(() => {
    if (!widget.storage?.availableSymbols) {
      updateWidget((prevWidget) => ({
        ...prevWidget,
        storage: {
          ...prevWidget.storage,
          availableSymbols: {
            Indices: [
              { label: "S&P 500", value: "FOREXCOM:SPXUSD" },
              { label: "Nasdaq 100", value: "FOREXCOM:NSXUSD" },
              { label: "Dow 30", value: "FOREXCOM:DJI" },
              { label: "Nikkei 225", value: "INDEX:NKY" },
              { label: "DAX Index", value: "INDEX:DEU30" },
              { label: "UK 100", value: "FOREXCOM:UKXGBP" },
            ],
            Commodities: [
              { label: "Euro", value: "CME:6E1!" },
              { label: "Gold", value: "COMEX:GC1!" },
              { label: "Crude Oil", value: "NYMEX:CL1!" },
              { label: "Natural Gas", value: "NYMEX:NG1!" },
              { label: "Corn", value: "CBOT:ZC1!" },
              { label: "Silver", value: "TVC:SILVER" },
              { label: "Copper", value: "CAPITALCOM:COPPER" },
              { label: "Wheat", value: "FOREXCOM:WHEAT" },
              { label: "Coffee", value: "FOREXCOM:COFFEE" },
              { label: "Sugar", value: "SUGAR" },
            ],
            Bonds: [
              { label: "T-Bond", value: "CBOT:ZB1!" },
              { label: "Ultra T-Bond", value: "CBOT:UB1!" },
              { label: "Euro Bund", value: "EUREX:FGBL1!" },
              { label: "Euro BTP", value: "EUREX:FBTP1!" },
              { label: "Euro BOBL", value: "EUREX:FGBM1!" },
            ],
            Forex: [
              { label: "EURUSD", value: "FX:EURUSD" },
              { label: "GBPUSD", value: "FX:GBPUSD" },
              { label: "USDJPY", value: "FX:USDJPY" },
              { label: "USDCHF", value: "FX:USDCHF" },
              { label: "AUDUSD", value: "FX:AUDUSD" },
              { label: "USDCAD", value: "FX:USDCAD" },
            ],
          },
        },
      }));
    }
    return widget.storage?.availableSymbols;
  }, [widget.storage?.availableSymbols, updateWidget]);

  const [market, setMarket] = useState(widget.storage?.selectedMarket || "Indices");

  const availableMarkets = useMemo(
    () => Object.keys(availableSymbols).map((key) => ({ label: key, value: key })),
    [availableSymbols],
  );

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

  const handleMarketRemove = useCallback(
    (val: string) => {
      updateWidget((prevWidget) => {
        const updatedSymbols = { ...prevWidget.storage?.availableSymbols };
        delete updatedSymbols[val];
        const newMarket =
          market === val ? Object.keys(updatedSymbols)[0] || "" : market;
        setMarket(newMarket);
        return {
          ...prevWidget,
          storage: {
            ...prevWidget.storage,
            availableSymbols: updatedSymbols,
            selectedMarket: newMarket,
          },
        };
      });
    },
    [market, updateWidget],
  );

  const handleMarketAdd = useCallback(
    (newMarket: { label: string; value: string }) => {
      updateWidget((prevWidget) => ({
        ...prevWidget,
        storage: {
          ...prevWidget.storage,
          availableSymbols: {
            ...prevWidget.storage?.availableSymbols,
            [newMarket.value]: [],
          },
          selectedMarket: newMarket.value,
        },
      }));
      setMarket(newMarket.value);
    },
    [updateWidget],
  );

  const handleSymbolSelect = useCallback((_val: string) => {
    // not used
  }, []);

  const handleSymbolRemove = useCallback(
    (val: string) => {
      updateWidget((prevWidget) => ({
        ...prevWidget,
        storage: {
          ...prevWidget.storage,
          availableSymbols: {
            ...prevWidget.storage?.availableSymbols,
            [market]: prevWidget.storage?.availableSymbols[market].filter(
              (symbol) => symbol.value !== val,
            ),
          },
        },
      }));
    },
    [market, updateWidget],
  );

  const handleSymbolAdd = useCallback(
    (newSymbol) => {
      updateWidget((prevWidget) => ({
        ...prevWidget,
        storage: {
          ...prevWidget.storage,
          availableSymbols: {
            ...prevWidget.storage?.availableSymbols,
            [market]: [
              ...(prevWidget.storage?.availableSymbols[market] ?? []),
              newSymbol,
            ],
          },
        },
      }));
    },
    [market, updateWidget],
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
        <>
          <NewAdvancedSelectAddEdit
            selected={market}
            label={market}
            onSelect={handleMarketSelect}
            onRemove={handleMarketRemove}
            onAdd={handleMarketAdd}
            values={availableMarkets}
          />
          <NewAdvancedSelectAddEdit
            label={market}
            onSelect={handleSymbolSelect}
            onRemove={handleSymbolRemove}
            onAdd={handleSymbolAdd}
            values={availableSymbols[market]}
            allowSelection={false}
            selectionListType="Symbols"
          />
        </>
      }
    >
      <SetLoadingOnResize>
        <MarketOverview
          autosize={true}
          showChart={true}
          height={400}
          width="100%"
          colorTheme={theme === "dark" ? "dark" : "light"}
          showFloatingTooltip={true}
          copyrightStyles={{
            parent: {
              display: "none",
            },
          }}
          tabs={[
            {
              title: market,
              originalTitle: market,
              symbols: availableSymbols[market].map((symbol) => ({
                s: symbol.value,
                d: symbol.label,
              })),
            },
            ...Object.entries(availableSymbols)
              .filter(([key]) => key !== market)
              .map(([key, symbols]) => ({
                title: key,
                originalTitle: key,
                symbols: symbols.map((symbol) => ({
                  s: symbol.value,
                  d: symbol.label,
                })),
              })),
          ]}
        />
      </SetLoadingOnResize>
    </DraggableCard>
  );
});

export default TradingViewWidget;
