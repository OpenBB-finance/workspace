import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { keepPreviousData } from "@tanstack/react-query";
import { QuickScore } from "quick-score";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDebounceValue, useUpdateEffect } from "usehooks-ts";
import { Input } from "~/components/ds/atoms/Input";
import { useIsFirstRender } from "~/components/General/Table/hooks/utils";
import Icon from "~/components/Icon";
import ChevronDownIcon from "~/components/Icons/ChevronDown";
import CloseIcon from "~/components/Icons/Close";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useUpdateWidgetTickers } from "~/hooks/useUpdateWidgetTickers";
import { useQuerySymbols } from "~/lib/api/sdkComponents";
import type { FilterTypes, FMPTicker, IgnoreTypes } from "~/lib/api/sdkSchemas";
import { type Ticker, useShallowAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowTutorialStore } from "~/lib/state/tutorial";
import {
  cn,
  generateRandomColor,
  getSupportedAssetClasses,
  getTickerParamName,
} from "~/lib/utils";
import {
  searchSecuritiesWithQuickscore,
  tickerCategories,
} from "./AdvancedSelectedTickers";
import GroupDropdown from "./GroupDropdown";

// import SYMBOLS from "./symbols.json";

function dispatchEsc() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
    }),
  );
}

export function resultsToTicker(results: FMPTicker[]): Ticker[] {
  const tickers_fmp =
    (results as FMPTicker[] & Pick<Ticker, "category" | "id">[]) ?? [];

  for (const ticker of tickers_fmp) {
    ticker.category = ticker?.category
      ? ticker.category
      : tickerCategories?.[ticker.type] || "equity";
    ticker.id = ticker.symbol.replace(/[\^$]/, "");

    for (const key in ticker) {
      if (ticker[key] === null) {
        ticker[key] = "";
      }
    }
  }

  return tickers_fmp as Ticker[];
}

export function queryDataToTickerResults(data: any): {
  total: number;
  results: Ticker[];
} {
  if (!data) return { total: 0, results: [] };
  const tickers_fmp = resultsToTicker(data?.results);

  return {
    total: data?.total ?? 0,
    results: tickers_fmp as Ticker[],
  };
}

// function getDerivativeSymbols() {
//   return {
//     results: SYMBOLS.map(
//       (symbol) =>
//         ({
//           symbol: symbol.symbol,
//           name: symbol.name,
//           type: symbol.type,
//           category: "derivative",
//           id: symbol.symbol,
//         }) as FMPTicker & Pick<Ticker, "category" | "id">,
//     ),
//     total: SYMBOLS.length,
//   };
// }

interface SelectedTickerProps {
  ticker?: Ticker;
  setTicker?: (ticker: Ticker) => void;
  triggerSize?: "base" | "sm";
  ignoreTypes?: IgnoreTypes | IgnoreTypes[];
  firstWatchlistFromWidgets?: Ticker[];
}

function useQuerySymbolsWithQuickscore({
  supportedTypes,
  ignoreTypes,
}: {
  supportedTypes?: FilterTypes[];
  ignoreTypes?: IgnoreTypes | IgnoreTypes[];
}) {
  const [state, dispatch] = useStateReducer({ open: false, input: "" });
  const isFirstRender = useIsFirstRender();

  const [debouncedInput] = useDebounceValue(state.input, 100);

  const { data, isLoading } = useQuerySymbols(
    {
      queryParams: {
        q: debouncedInput || "",
        ...(supportedTypes?.includes("all") ? {} : { type: supportedTypes }),
        ...(ignoreTypes ? { ignore_type: ignoreTypes } : {}),
        limit: 40,
      },
    },
    {
      enabled: isFirstRender || state.open,
      staleTime: 1000 * 60 * 60 * 24,
      placeholderData: keepPreviousData,
    },
  );

  const tickersFmp = resultsToTicker(data?.results);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const quickscoreInstance = new QuickScore(tickersFmp, {
    keys: ["symbol", "name"],
  }) as QuickScore<Ticker>;

  const topResults = useMemo(() => {
    if (!tickersFmp) return [];
    if (!debouncedInput) return tickersFmp;

    const { results } = searchSecuritiesWithQuickscore(state.input, quickscoreInstance);
    return results;
  }, [debouncedInput, quickscoreInstance, tickersFmp, state.input]);

  function handleHighlight(e: KeyboardEvent) {
    if (!dropdownRef.current) return;

    e.stopPropagation();
    e.preventDefault();
    const isDown = e.key === "ArrowDown";
    const results = dropdownRef.current.querySelectorAll("fieldset");
    let nextItem: HTMLFieldSetElement | null = null;

    const currentlyHighlighted = dropdownRef.current.querySelector(
      "fieldset[class*='bg-light-100 dark:bg-[#46464F]']",
    ) as HTMLFieldSetElement;

    if (currentlyHighlighted) {
      currentlyHighlighted.classList.remove("bg-light-100", "dark:bg-[#46464F]");
      const itemIndex = Array.from(results).indexOf(
        currentlyHighlighted as HTMLFieldSetElement,
      );
      let nextIndex = isDown ? itemIndex + 1 : itemIndex - 1;
      if (nextIndex < 0 || nextIndex >= results.length) {
        nextIndex = isDown ? 0 : results.length - 1;
      }
      nextItem = results[nextIndex] as HTMLFieldSetElement;
    } else {
      nextItem = (
        isDown ? results[0] : results[results.length - 1]
      ) as HTMLFieldSetElement;
    }

    if (nextItem) {
      (nextItem as HTMLFieldSetElement).classList.add(
        "bg-light-100",
        "dark:bg-[#46464F]",
      );
      nextItem.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }

  useLayoutEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown"].includes(e.key)) return handleHighlight(e);

      let currentlyHighlighted: HTMLFieldSetElement | null = null;
      if (dropdownRef.current) {
        currentlyHighlighted = dropdownRef.current.querySelector(
          "fieldset[class*='bg-light-100 dark:bg-[#46464F]']",
        ) as HTMLFieldSetElement;
      }

      if (e.key === "Enter") {
        e.stopPropagation();
        e.preventDefault();

        if (currentlyHighlighted) {
          currentlyHighlighted.click();

          setTimeout(() => {
            currentlyHighlighted.querySelector("button")?.click();

            dispatchEsc();
          }, 100);

          return;
        }

        if (!dropdownRef.current) return;

        const results = dropdownRef.current.querySelectorAll("fieldset");
        for (const el of results) {
          if (inputRef.current?.value === el.querySelector("strong")?.innerHTML) {
            el.click();
            setTimeout(() => {
              el.querySelector("button")?.click();

              dispatchEsc();
            }, 100);
            break;
          }
        }
      }

      if (currentlyHighlighted)
        currentlyHighlighted.classList.remove("bg-light-100", "dark:bg-[#46464F]");
    };

    if (inputRef.current !== null && dropdownRef.current !== null) {
      inputRef.current.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      if (inputRef.current !== null && dropdownRef.current !== null) {
        inputRef.current.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [inputRef.current, dropdownRef.current]);

  useUpdateEffect(() => {
    if (inputRef.current !== null && dropdownRef.current !== null) {
      inputRef.current.focus();
    }
  }, [state.open, inputRef, dropdownRef]);

  const { currentTutorial, currentStep, goToStep } = useShallowTutorialStore(
    (tState) => ({
      currentTutorial: tState.currentTutorial,
      currentStep: tState.currentStep,
      goToStep: tState.goToStep,
    }),
  );

  useEffect(() => {
    if (state.open) {
      if (currentTutorial) {
        if (currentTutorial === "grouping") {
          if (currentStep === 5) {
            setTimeout(() => {
              goToStep(6);
            }, 500);
          }
        }
      }
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    dispatch({ input: "" });
  }, [state.open]);

  return {
    state,
    dispatch,
    inputRef,
    dropdownRef,
    isLoading,
    topResults,
  };
}

function isSupportedItem(item: Ticker, supportedTypes: FilterTypes[]) {
  return (
    supportedTypes.includes("all") ||
    supportedTypes.includes(item.type as FilterTypes) ||
    (supportedTypes.includes("options") && item.has_options)
  );
}

export function SelectedTicker(props: SelectedTickerProps) {
  const { searchTickerHistory, updateSearchTickerHistory } = useShallowAuthStore(
    (authState) => ({
      searchTickerHistory: authState.searchTickerHistory,
      updateSearchTickerHistory: authState.updateSearchTickerHistory,
    }),
  );

  const { widgetId, data: { mainTicker = props?.ticker } = {} } =
    useWidgetContext(true)?.widget || {};

  const [localTicker, setLocalTicker] = useState<Ticker | undefined>(
    props?.ticker ?? mainTicker,
  );

  const {
    setTicker,
    triggerSize = "base",
    ignoreTypes = null,
    firstWatchlistFromWidgets = [],
  } = props;

  const supportedTypes = useMemo(
    () =>
      getSupportedAssetClasses(widgetId).map((type) =>
        type?.toLowerCase()?.replace("equity", "stock"),
      ) as FilterTypes[],
    [widgetId],
  );

  const { state, dispatch, inputRef, dropdownRef, isLoading, topResults } =
    useQuerySymbolsWithQuickscore({ supportedTypes, ignoreTypes });

  const { currentTutorial, currentStep, goToStep } = useShallowTutorialStore(
    (tutorialState) => ({
      currentTutorial: tutorialState.currentTutorial,
      currentStep: tutorialState.currentStep,
      goToStep: tutorialState.goToStep,
    }),
  );

  useEffect(() => {
    if (mainTicker?.symbol !== localTicker?.symbol) {
      setLocalTicker(mainTicker);
    }
  }, [mainTicker?.symbol]);

  return (
    <DropdownMenu.Root onOpenChange={(open) => dispatch({ open })}>
      <DropdownMenu.Trigger asChild={true}>
        <button
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("._group-dropdown-trigger")) {
              e.stopPropagation();
              e.preventDefault();
            }
          }}
          className={cn(
            "flex items-center justify-between gap-1 cursor-pointer",
            {
              "h-[24px] w-fit py-1 text-base": triggerSize === "base",
              "h-[20px] text-xs": triggerSize === "sm",
            },
            "_select-ticker",
          )}
        >
          <span
            className={cn("text-left min-w-fit text2xs", {
              "w-fit": triggerSize === "base",
              "max-w-[calc(100%-10px)] truncate": triggerSize === "sm",
            })}
          >
            {localTicker
              ? localTicker.name && triggerSize === "base"
                ? `${localTicker.symbol} (${localTicker.name})`
                : localTicker.symbol
              : "Select a ticker"}
          </span>
          <ChevronDownIcon
            className={cn({
              "h-4 w-4": triggerSize === "base",
              "h-3 w-3": triggerSize === "sm",
            })}
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          alignOffset={-23} // https://openbb.atlassian.net/browse/AA-3579 needed otherwise the dropdown is not aligned with the trigger
          sideOffset={5}
          style={{
            boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
          }}
          className={cn(
            "obb-dropdown-container",
            "flex flex-col gap-2 p-2",
            "text-xs",
            "z-50 w-[600px]",
          )}
        >
          <div className="relative w-full">
            <Input
              ref={inputRef}
              className="w-full"
              placeholder="Search ticker"
              size="sm"
              prefix={<Icon id="search" />}
              value={state.input}
              onChange={(value) => dispatch({ input: String(value).toUpperCase() })}
            />
            {state.input && (
              <button
                type="button"
                className="absolute right-0 top-0 flex h-full items-center px-2"
                onClick={() => {
                  dispatch({ input: "" });
                  inputRef.current?.focus();
                }}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <div
            className="flex max-h-[calc(50vh-100px)]! flex-col divide-y divide-surface-divider overflow-y-auto"
            ref={dropdownRef}
          >
            {searchTickerHistory?.length > 0 && !state.input && (
              <div className="py-2.5">
                <p className="text-2xs uppercase tracking-wide dark:text-[#5A5961] text-light-600">
                  RECENT
                </p>
                {searchTickerHistory
                  .filter(
                    (item, index, self) =>
                      self.findIndex((i) => i.symbol === item.symbol) === index &&
                      isSupportedItem(item, supportedTypes),
                  )
                  .slice(0, 5)
                  .map((item) => {
                    return (
                      <fieldset
                        key={`recent_${item.symbol}_${item.type}`}
                        className="flex w-full cursor-pointer justify-between hover:bg-light-100 dark:hover:bg-[#46464F] rounded p-1.5 my-2"
                        onClick={() => {
                          dispatchEsc();
                          updateSearchTickerHistory([item, ...searchTickerHistory]);

                          const ticker = { ...item, color: generateRandomColor() };
                          setTicker(ticker);
                          setLocalTicker(ticker);
                        }}
                      >
                        <span className="flex gap-2">
                          <Tooltip message={item.symbol}>
                            <strong className="inline-block truncate w-24! text-left">
                              {item.symbol}
                            </strong>
                          </Tooltip>
                          <span
                            className="inline-block max-w-[400px] truncate text-left"
                            title={item.name}
                          >
                            {item.name}
                          </span>
                        </span>
                        <span className="space-x-2 text-light-500 text-2xs">
                          <span>{item?.type?.toUpperCase()}</span>
                          <span>{item?.exchange}</span>
                        </span>
                      </fieldset>
                    );
                  })}
              </div>
            )}
            {firstWatchlistFromWidgets?.length > 0 && !state.input && (
              <div className="py-2.5">
                <p className="text-2xs uppercase tracking-wide dark:text-[#5A5961] text-light-600">
                  WATCHLIST ELEMENTS
                </p>
                {firstWatchlistFromWidgets
                  .filter(
                    (item, index, self) =>
                      self.findIndex((i) => i.symbol === item.symbol) === index &&
                      isSupportedItem(item, supportedTypes),
                  )
                  .slice(0, 5)
                  .map((item) => {
                    return (
                      <fieldset
                        key={`watchlist_${item.symbol}_${item.type}_${item.name}`}
                        className={cn(
                          "flex w-full cursor-pointer justify-between hover:bg-general-bg-secondary rounded p-1.5 my-2",
                          `_watchlist-element-${item.symbol}`,
                        )}
                        onClick={() => {
                          dispatchEsc();
                          if (currentTutorial) {
                            if (currentTutorial === "grouping") {
                              if (currentStep === 6) {
                                setTimeout(() => {
                                  goToStep(7);
                                }, 500);
                              }
                            }
                          }
                          updateSearchTickerHistory([item, ...searchTickerHistory]);
                          item.color = generateRandomColor();
                          setLocalTicker(item);
                          setTicker(item);
                        }}
                      >
                        <span className="flex gap-2">
                          <Tooltip message={item.symbol}>
                            <strong className="inline-block truncate w-24! text-left">
                              {item.symbol}
                            </strong>
                          </Tooltip>
                          <span
                            className="inline-block max-w-[400px] truncate text-left"
                            title={item.name}
                          >
                            {item.name}
                          </span>
                        </span>
                        <span className="space-x-2 text-light-500 text-2xs">
                          <span>{item?.type?.toUpperCase()}</span>
                          <span>{item?.exchange}</span>
                        </span>
                      </fieldset>
                    );
                  })}
              </div>
            )}
            {isLoading ? (
              <div className="py-2.5">
                <div className="pt-2.5 text-xs text-light-600 dark:text-light-400">
                  Loading results...
                </div>
              </div>
            ) : topResults.length > 0 ? (
              <div className="py-2.5">
                <p className="text-2xs uppercase tracking-wide dark:text-[#5A5961] text-light-600">
                  TOP RESULTS
                </p>
                {topResults.slice(0, 10).map((equity: Ticker) => {
                  const symbol = equity?.symbol;
                  const name = equity?.name;
                  const type = equity?.type;

                  return (
                    <fieldset
                      key={`tickertop_${symbol}_${name}_${type}`}
                      className="flex w-full cursor-pointer justify-between hover:bg-light-100 dark:hover:bg-[#46464F] rounded p-1.5 my-2"
                      onClick={() => {
                        dispatchEsc();
                        updateSearchTickerHistory([equity, ...searchTickerHistory]);
                        equity.color = generateRandomColor();
                        setLocalTicker(equity);
                        setTicker(equity);
                      }}
                    >
                      <span className="flex gap-2">
                        <Tooltip message={symbol}>
                          <strong className="inline-block truncate w-24! text-left">
                            {symbol}
                          </strong>
                        </Tooltip>
                        <span
                          className="inline-block max-w-[400px] truncate text-left"
                          title={name}
                        >
                          {name}
                        </span>
                      </span>
                      <span className="space-x-2 text-light-500 text-2xs">
                        <span>{equity?.type?.toUpperCase()}</span>
                        <span>{equity?.exchange}</span>
                      </span>
                    </fieldset>
                  );
                })}
              </div>
            ) : (
              <div className="py-2.5">
                <p className="text-2xs uppercase tracking-wide dark:text-[#5A5961] text-light-600">
                  TOP RESULTS
                </p>
                <div className="pt-2.5 text-xs text-light-600 dark:text-light-400">
                  No results found
                </div>
              </div>
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

interface WrapperProps extends Omit<SelectedTickerProps, "firstWatchlistFromWidgets"> {}

export default function AdvancedSelectedTicker({
  ticker = undefined,
  setTicker = undefined,
  triggerSize = "base",
  ignoreTypes = null,
}: WrapperProps) {
  const { activeDashboardId, updateWidget } = useWidgetContext(true);

  useUpdateWidgetTickers();

  const firstWatchlistFromWidgets = useShallowAppStore(
    (state) =>
      state
        .getTabById(activeDashboardId)
        ?.data?.widgets?.find((widget) => widget?.widgetId === "watchlist")?.data
        ?.secondaryTickers,
  );

  const setTickerCb = useCallback(
    setTicker ??
      ((ticker: Ticker) => {
        updateWidget((prev) => {
          const tickerParam = getTickerParamName(prev);

          return {
            ...prev,
            data: {
              ...prev.data,
              mainTicker: ticker,
            },
            storage: {
              ...(prev.storage ?? ({} as any)),
              params: {
                ...(prev?.storage?.params ?? {}),
                // think we have to do this cause we arent using the ticker object everywhere
                [tickerParam]: ticker?.symbol || ticker,
              },
            },
          };
        });
      }),
    [setTicker, updateWidget],
  );

  return useMemo(() => {
    return (
      <GroupDropdown type="ticker">
        <SelectedTicker
          ticker={ticker}
          setTicker={setTickerCb}
          triggerSize={triggerSize}
          ignoreTypes={
            Array.isArray(ignoreTypes)
              ? (ignoreTypes.join(",") as IgnoreTypes)
              : ignoreTypes
          }
          firstWatchlistFromWidgets={firstWatchlistFromWidgets}
        />
      </GroupDropdown>
    );
  }, [firstWatchlistFromWidgets, setTickerCb, ticker, triggerSize, ignoreTypes]);
}
