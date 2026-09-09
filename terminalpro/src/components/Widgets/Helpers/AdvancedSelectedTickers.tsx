import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { keepPreviousData } from "@tanstack/react-query";
import clsx from "clsx";
import { QuickScore } from "quick-score";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useDebounceValue, useUpdateEffect } from "usehooks-ts";
import { Input } from "~/components/ds/atoms/Input";
import { Checkbox } from "~/components/Forms/Checkbox";
import { useIsFirstRender } from "~/components/General/Table/hooks/utils";
import Icon from "~/components/Icon";
import ChevronDownIcon from "~/components/Icons/ChevronDown";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useUpdateWidgetTickers } from "~/hooks/useUpdateWidgetTickers";
import { useQuerySymbols } from "~/lib/api/sdkComponents";
import type { FilterTypes, IgnoreTypes } from "~/lib/api/sdkSchemas";
import type { Ticker } from "~/lib/state/app";
import { useAuthStore } from "~/lib/state/auth";
import { getSupportedAssetClasses } from "~/lib/utils";
import { changeStep } from "~/lib/utils/tutorial";
import { resultsToTicker } from "./AdvancedSelectTicker";

export function searchSecuritiesWithQuickscore(
  input: string,
  qsEquities: QuickScore<Ticker>,
) {
  const equity = qsEquities.search(input);
  return {
    results: equity
      .map(({ item }) => item)
      .sort((a, b) => {
        if (a.symbol.includes(".") && !b.symbol.includes(".")) return 1;
        if (!a.symbol.includes(".") && b.symbol.includes(".")) return -1;
        return 0;
      }),
    noValues: equity.length === 0 && input.length > 0,
  } as {
    results: Ticker[];
    noValues: boolean;
  };
}

function dispatchEsc() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
    }),
  );
}

export const tickerCategories = {
  stock: "equity",
  etf: "etf",
  index: "indices",
  derivative: "futures",
} as const;

export default function AdvancedSelectedTickers(props: {
  tickers?: Ticker[];
  setTickers: (tickers: Ticker[], mainTicker?: Ticker) => void;
  triggerSize?: "base" | "sm";
  ignoreTypes?: IgnoreTypes | IgnoreTypes[];
  triggerInside?: ReactNode;
  allowZeroTickers?: boolean;
  mainTicker?: Ticker;
  ignoreMainTicker?: boolean;
  className?: string;
}) {
  const [state, dispatch] = useStateReducer({ open: false, input: "" });
  const isFirstRender = useIsFirstRender();

  const [debouncedInput] = useDebounceValue(state.input, 100);
  const { searchTickerHistory, updateSearchTickerHistory } = useAuthStore();
  const { widgetId, data: { mainTicker: wMainTicker, secondaryTickers } = {} } =
    useWidgetContext()?.widget || {};

  let {
    tickers = secondaryTickers,
    setTickers,
    triggerSize = "base",
    ignoreTypes,
    triggerInside,
    allowZeroTickers = false,
    mainTicker = wMainTicker,
    ignoreMainTicker = false,
    className = "obb-parameter",
  } = props;

  useUpdateWidgetTickers();

  const supportedTypes = useMemo(
    () =>
      getSupportedAssetClasses(widgetId).map((type) =>
        type?.toLowerCase()?.replace("equity", "stock"),
      ) as FilterTypes[],
    [widgetId],
  );

  const { data } = useQuerySymbols(
    {
      queryParams: {
        q: debouncedInput || "",
        ...(supportedTypes?.includes("all") ? {} : { type: supportedTypes }),
        ...(ignoreTypes ? { ignore_type: ignoreTypes } : {}),
        limit: 50,
      },
    },
    {
      staleTime: 1000 * 60 * 60 * 24 * 7,
      enabled: isFirstRender || state.open,
      placeholderData: keepPreviousData,
    },
  );

  const tickersFmp = resultsToTicker(data?.results);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const quickscoreInstance = new QuickScore(tickersFmp, {
    keys: ["symbol", "name"],
  }) as QuickScore<Ticker>;

  const results = useMemo(() => {
    if (!tickersFmp) return [];
    if (!debouncedInput) return tickersFmp;

    const { results: topResults } = searchSecuritiesWithQuickscore(
      state.input,
      quickscoreInstance,
    );
    return topResults;
  }, [debouncedInput, quickscoreInstance, tickersFmp]);

  function handleHighlight(e: KeyboardEvent) {
    if (!dropdownRef.current) return;

    e.stopPropagation();
    e.preventDefault();
    const isDown = e.key === "ArrowDown";
    const results = dropdownRef.current.querySelectorAll(".item");
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

  useEffect(() => {
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
          return;
        }

        if (!dropdownRef.current) return;

        const results = dropdownRef.current.querySelectorAll(
          ".item",
        ) as NodeListOf<HTMLFieldSetElement>;
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

  useEffect(() => {
    if (state.open) {
      changeStep("group_sector_companies", 1);
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    dispatch({ input: "" });
  }, [state.open]);

  useEffect(() => {
    changeStep("group_sector_companies", 2, () => {
      dispatchEsc();
    });
  }, [tickers]);

  if (typeof tickers?.[0] === "string")
    tickers = tickersFmp.filter((item: any) => tickers?.includes(item?.symbol));

  return (
    <DropdownMenu.Root onOpenChange={(open) => dispatch({ open })}>
      <DropdownMenu.Trigger
        className={clsx(
          "flex items-center justify-between gap-1 _tutorial-select-tickers pr-1",
          className,
          {
            "h-[24px] w-fit py-1 text-base": triggerSize === "base",
            "h-[20px] text-xs": triggerSize === "sm",
          },
        )}
      >
        {triggerInside ? (
          triggerInside
        ) : (
          <>
            <span
              className={clsx("text-left", {
                "w-fit": triggerSize === "base",
                "max-w-[calc(100%-10px)] truncate": triggerSize === "sm",
              })}
            >
              {tickers?.map((ticker) => ticker.id).join(", ")}
            </span>
            <ChevronDownIcon
              className={clsx({
                "size-4": triggerSize === "base",
                "size-3": triggerSize === "sm",
              })}
            />
          </>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={5}
          style={{
            boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
          }}
          className={clsx(
            "obb-dropdown-container",
            "flex flex-col gap-2 p-2",
            "text-xs",
            "z-50 w-[600px]",
            "_tutorial-select-tickers-container",
          )}
        >
          <Input
            ref={inputRef}
            className="w-full"
            placeholder="Search ticker"
            size="sm"
            prefix={<Icon id="search" />}
            value={state.input}
            onChange={(value) => dispatch({ input: String(value).toUpperCase() })}
          />
          <div
            className="flex max-h-[calc(70vh-200px)]! flex-col divide-y divide-surface-divider overflow-y-auto"
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
                      !tickers?.some((ticker) => ticker?.symbol === item.symbol) &&
                      (ignoreMainTicker || item.symbol !== mainTicker?.symbol),
                  )
                  .slice(0, 5)
                  .map((item) => {
                    return (
                      <fieldset
                        key={`recent_${item.symbol}_${item.type}`}
                        className="flex w-full cursor-pointer justify-between hover:bg-light-100 dark:hover:bg-[#46464F] rounded p-1.5 my-2"
                        onClick={() => {
                          dispatchEsc();
                          const ticker = { ...item };
                          updateSearchTickerHistory([ticker, ...searchTickerHistory]);
                          setTickers(
                            Object.values(
                              Object.fromEntries(
                                [...tickers, ticker].map((item) => [item.symbol, item]),
                              ),
                            ),
                            mainTicker,
                          );
                          dispatch({ input: "" });
                          inputRef.current?.focus();
                        }}
                      >
                        <span className="flex gap-2">
                          <strong className="inline-block w-24! text-left">
                            {item.symbol}
                          </strong>
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
            <div className="py-2.5">
              <p className="text-2xs uppercase tracking-wide dark:text-[#5A5961] text-light-600">
                CURRENT
              </p>
              {tickers?.map((ticker: Ticker) => {
                return (
                  <fieldset
                    onClick={() => {
                      document
                        .getElementById(`selectedTickers_${ticker.symbol}`)
                        ?.click();
                    }}
                    key={`current_${ticker.symbol}_${ticker.name}`}
                    className="item flex w-full cursor-pointer justify-between hover:bg-light-100 dark:hover:bg-[#46464F] rounded p-1.5 my-2"
                  >
                    <span className="flex gap-1">
                      <span className="inline-flex gap-1">
                        <Checkbox
                          id={`selectedTickers_${ticker.symbol}`}
                          checked={true}
                          onChange={() => {
                            const newTickers = tickers.filter(
                              (item) => item?.symbol !== ticker.symbol,
                            );
                            if (newTickers.length === 0 && !allowZeroTickers) {
                              toast.warning("One ticker required", {
                                description:
                                  "You must have at least one ticker selected",
                              });
                            } else {
                              setTickers(newTickers, mainTicker);
                              dispatch({ input: "" });
                              inputRef.current?.focus();
                            }
                          }}
                        />
                        <strong className="inline-block w-24! text-left">
                          {ticker.id}
                        </strong>
                      </span>
                      <span
                        className="inline-block max-w-[400px] truncate text-left"
                        title={ticker.name}
                      >
                        {ticker.name}
                      </span>
                    </span>
                    <span className="space-x-2 text-light-500 text-2xs">
                      <span>{ticker?.type?.toUpperCase()}</span>
                      <span>{ticker?.exchange}</span>
                    </span>
                  </fieldset>
                );
              })}
            </div>
            {results.length > 0 ? (
              <div className="py-2.5">
                <p className="text-2xs uppercase tracking-wide dark:text-[#5A5961] text-light-600">
                  TOP RESULTS
                </p>
                {results
                  .filter(
                    (item: Ticker) =>
                      !tickers?.some((ticker) => ticker?.symbol === item?.symbol) &&
                      (ignoreMainTicker || item.symbol !== mainTicker?.symbol),
                  )
                  .slice(0, 10)
                  .map((equity: Ticker) => {
                    const symbol = equity?.symbol;
                    const name = equity?.name;
                    const type = equity?.type;

                    return (
                      <fieldset
                        key={`top_${symbol}_${name}_${type}`}
                        onClick={() =>
                          document.getElementById(`selectedTickers_${symbol}`)?.click()
                        }
                        className="item flex w-full cursor-pointer justify-between hover:bg-light-100 dark:hover:bg-[#46464F] rounded p-1.5 my-2"
                      >
                        <span className="flex gap-1">
                          <span className="inline-flex gap-1">
                            <Checkbox
                              id={`selectedTickers_${symbol}`}
                              checked={tickers?.some((item) => item?.symbol === symbol)}
                              onChange={(val) => {
                                if (val) {
                                  setTickers(
                                    Object.values(
                                      Object.fromEntries(
                                        [...tickers, equity].map((item) => [
                                          item.symbol,
                                          item,
                                        ]),
                                      ),
                                    ),
                                    mainTicker,
                                  );
                                  dispatch({ input: "" });
                                  inputRef.current?.focus();
                                }
                              }}
                            />
                            <strong className="inline-block w-24! text-left">
                              {equity?.id}
                            </strong>
                          </span>
                          <span
                            className="inline-block max-w-[400px] truncate text-left"
                            title={name}
                          >
                            {name}
                          </span>
                        </span>
                        <span className="space-x-2 text-light-500 text-2xs">
                          <span>{type?.toUpperCase()}</span>
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
