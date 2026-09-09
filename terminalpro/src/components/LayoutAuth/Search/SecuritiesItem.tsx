import { forwardRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { type Ticker, useAppStore, useShallowAppStore } from "~/lib/state/app";
import { useThemeStore } from "~/lib/state/theme";
import { createEquityTemplateTab } from "~/lib/utils/createTemplates";

const SecuritiesItem = forwardRef<
  HTMLButtonElement,
  {
    index: number;
    ticker: Ticker;
  }
>(({ ticker }, ref) => {
  const addTab = useShallowAppStore((state) => state.addTab);

  const { id } = useParams();
  const { changeSearch } = useThemeStore();
  const navigate = useNavigate();

  return (
    <button
      onClick={() => {
        const items = useAppStore.getState().items;
        changeSearch(false);

        createEquityTemplateTab(
          {
            name: ticker.id,
          },
          {
            addTab,
            navigate,
            items,
            currentDashboard: id,
            defaultTicker: ticker,
          },
        );
      }}
      ref={ref}
      className="flex items-center gap-2.5 rounded px-1 py-1.5 w-full hover:bg-light-100 dark:hover:bg-[#303038] justify-between focus:bg-light-100 dark:focus:bg-[#303038] text-xs"
    >
      {/* <span className="px-1 bg-light-100 text-light-900 dark:text-light-200 dark:bg-light-700 rounded dark:border-light-500 border-light-100 border text-[8px] h-[26px] whitespace-nowrap flex items-center justify-center">
                    CTRL + {index}
                </span>*/}
      <div className="flex">
        <span className="font-bold uppercase w-[100px] text-left tracking-[1px]">
          {ticker.id}
        </span>
        <span className="uppercase text-left dark:text-light-200">{ticker.name}</span>
      </div>
      <span className="text-light-500 dark:text-[#6D6E74] uppercase text-2xs tracking-[1px]">{`${ticker.type} ${ticker.country} - ${ticker.exchange}`}</span>
    </button>
  );
});

export default SecuritiesItem;
