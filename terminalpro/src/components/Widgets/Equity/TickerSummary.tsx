import clsx from "clsx";
import { useState } from "react";
import { useUpdateEffect } from "usehooks-ts";
import DraggableCard from "~/components/DraggableCard";
import { useWidgetContext } from "~/components/Widget.context";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

export default function TickerSummary() {
  const { widget } = useWidgetContext();
  const [data, setData] = useState<{
    changeLast3Days: number;
    changeLastDay: number;
    rsi: number;
    macd: number;
  }>({ changeLast3Days: 0.5, changeLastDay: 0.2, rsi: 50, macd: 0.2 });

  useUpdateEffect(() => {
    setData({
      changeLast3Days: Math.round((Math.random() * 20 - 10) * 100) / 100,
      changeLastDay: Math.round((Math.random() * 20 - 10) * 100) / 100,
      rsi: Math.round(Math.random() * 100) / 100,
      macd: Math.round(Math.random() * 100) / 100,
    });
  }, [widget.data?.mainTicker?.symbol]);
  return (
    <DraggableCard
      elementRightNextToTitle={<AdvancedSelectedTicker triggerSize="sm" />}
    >
      <div className="w-full h-full">
        <p>
          {widget.data?.mainTicker?.symbol} price has changed{" "}
          <span
            className={clsx({
              "text-green-500": data.changeLast3Days > 0,
              "text-red-500": data.changeLast3Days < 0,
            })}
          >
            {data.changeLast3Days}%
          </span>{" "}
          in the last 3 days and{" "}
          <span
            className={clsx({
              "text-green-500": data.changeLast3Days > 0,
              "text-red-500": data.changeLast3Days < 0,
            })}
          >
            {data.changeLastDay}%
          </span>{" "}
          yesterday.
        </p>
        <p>
          RSI is greater than{" "}
          <span
            className={clsx({
              "text-green-500": data.rsi > 50,
              "text-red-500": data.rsi < 50,
            })}
          >
            {data.rsi}
          </span>{" "}
          and the indicator is pointing downwards.
        </p>
        <p>
          MACD is in the{" "}
          <span
            className={clsx({
              "text-green-500": data.macd > 50,
              "text-red-500": data.macd < 50,
            })}
          >
            bearish
          </span>{" "}
          area and the histogram is moving upwards.
        </p>
        <p>
          {widget.data?.mainTicker?.symbol} price is trading above the 200-day SMA line
          and the SMA is trending up.
        </p>
        <p>The asset price is between the Upper and the Middle Bollinger Bands.</p>
      </div>
    </DraggableCard>
  );
}
