import { useSearchParams } from "react-router-dom";
import TvChart from "~/components/Widgets/TvChart";

export default function NewCharting() {
  const [searchParams] = useSearchParams();
  const mainTicker = searchParams.get("ticker") ?? "";
  const secondTickers = searchParams.get("secondTickers")?.split(",") ?? [];

  return (
    <div className="mx-[22px] my-[10px] bg-white dark:bg-[#151518] rounded h-[96.5vh]">
      <TvChart
        ticker={mainTicker}
        secondTickers={secondTickers?.filter((ticker) => ticker !== mainTicker)}
        extraClassName="w-full h-full rounded overflow-hidden"
      />
    </div>
  );
}
