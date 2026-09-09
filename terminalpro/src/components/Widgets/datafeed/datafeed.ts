import type { AxiosError } from "axios";
import dayjs from "dayjs";
import { round } from "lodash";
import {
  type EquityPriceHistoricalQueryParams,
  fetchEconomyFredSeries,
  fetchEquityFundamentalBalance,
  fetchEquityFundamentalCash,
  fetchEquityFundamentalHistoricalEps,
  fetchEquityFundamentalIncome,
  fetchEquityPriceHistorical,
  fetchIndexMarket,
  fetchQueryUdfSearch,
  fetchQueryUdfSymbols,
} from "~/lib/api/sdkComponents";
import type { FMPHistoricalEpsData as FMPHistoricalEps } from "~/lib/api/sdkSchemas";
import type {
  Bar,
  GetMarksCallback,
  SearchSymbolResultItem,
  TimescaleMark,
} from "~/lib/charting_library";
import type {
  DatafeedConfiguration,
  ErrorCallback,
  HistoryCallback,
  HistoryMetadata,
  LibrarySymbolInfo,
  OnReadyCallback,
  ResolutionString,
  ResolveCallback,
  SearchSymbolsCallback,
  ServerTimeCallback,
  SubscribeBarsCallback,
  SymbolResolveExtension,
} from "~/lib/charting_library/datafeed-api";
import { log } from "./helper";
import type { PeriodParamsWithOptionalCountback } from "./history-provider";
import type { ChartDataFeed, WeightedItem } from "./type";

const supportedResolutions = [
  "1",
  "5",
  "15",
  "30",
  "60", // 1 hour
  "120", // 2 hours
  "240", // 4 hours
  "D",
  "W",
  "M",
  "3M",
  "6M",
  "12M",
] as ResolutionString[];

const _lastCandleTimestamp = 0;
const spreadRegex = /[/+*-]/g;

function getFetchFunc(type: string) {
  const fetchFuncs = {
    income: fetchEquityFundamentalIncome,
    balance: fetchEquityFundamentalBalance,
    cashflow: fetchEquityFundamentalCash,
    stock: fetchEquityPriceHistorical,
    economic: fetchEconomyFredSeries,
    index: fetchIndexMarket,
  };

  return fetchFuncs[type] || fetchEquityPriceHistorical;
}

const config: DatafeedConfiguration = {
  supported_resolutions: supportedResolutions,
  supports_marks: true,
  supports_timescale_marks: true,
  supports_time: true,
  symbols_types: [
    { name: "All", value: "all" },
    { name: "Stocks", value: "stock" },
    { name: "Funds", value: "etf" },
    { name: "Forex", value: "forex" },
    { name: "Crypto", value: "crypto" },
    { name: "Indices", value: "index" },
    { name: "Economy", value: "economic" },
  ],
};

const savedStatements = new Map() as Map<
  string,
  { s: "ok" | "error" | "no_data"; bars: Bar[] }
>;
const cachedBars = new Map() as Map<string, Set<number>>;

const datafeed: ChartDataFeed = {
  chartId: "",
  subscriberId: "",
  lastBar: {} as Bar,
  lastFredCall: 0,
  _keepFetching: true,
  onReady: async function onReady(cb: OnReadyCallback): Promise<void> {
    log("[tvdf: onReady]: executed");

    // resolves warning: `onReady` should return result asynchronously. Use `setTimeout` with 0 interval to execute the callback function.
    setTimeout(() => cb(config), 0);
  },
  searchSymbols: async function searchSymbols(
    this: ChartDataFeed,
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: SearchSymbolsCallback,
  ): Promise<void> {
    try {
      return fetchQueryUdfSearch({
        queryParams: {
          query: userInput?.toUpperCase()?.replace(/[\^$]/, "").replace(/_/g, "-"),
          limit: 30,
          type: symbolType,
          exchange,
        },
      })

        .then(async (data) => {
          const weightedResult: WeightedItem[] = [];
          const queryIsEmpty = userInput.length === 0;
          for (const item of data) {
            item.symbol = item?.symbol?.replace(/-/g, "_");
            item.ticker = item?.ticker?.replace(/-/g, "_");
            item.name = item?.symbol;
            // @ts-expect-error
            item.full_name = item?.name;
            item.logo_urls = item?.logo_urls?.length ? item.logo_urls : null;

            const positionInName = item.name.toUpperCase().indexOf(userInput);
            const positionInDescription = item.description
              .toUpperCase()
              .indexOf(userInput);

            if (queryIsEmpty || positionInName >= 0 || positionInDescription >= 0) {
              const alreadyExists = weightedResult.some(
                (w: WeightedItem) => w.symbolInfo === item,
              );
              if (!alreadyExists) {
                const weight =
                  positionInName >= 0 ? positionInName : 8000 + positionInDescription;
                weightedResult.push({ symbolInfo: item, weight: weight });
              }
            }
          }

          const result = weightedResult
            .sort((a, b) => a.weight - b.weight)
            .map((w) => w.symbolInfo);

          return onResult(result as SearchSymbolResultItem[]);
        })
        .catch((e: Error) => {
          if (import.meta.env.DEV) console.error(e);
          this.searchSymbols("AAPL", exchange, symbolType, onResult);
        });
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      onResult([]);
    }
  },
  resolveSymbol: async function resolveSymbol(
    this: ChartDataFeed,
    symbolName: string,
    onResolve: ResolveCallback,
    onError: ErrorCallback,
    extension?: SymbolResolveExtension,
  ): Promise<void> {
    const subsession_id = extension?.session || "regular";
    const [ticker, statementType, period, metric] = symbolName.split("-");
    const isStatement =
      ["income", "balance", "cashflow"].includes(statementType) && metric;

    const operations = symbolName.match(spreadRegex) || [];
    const spreadTickers = symbolName.split(spreadRegex).filter((s) => s !== "");
    const newTicker = isStatement ? ticker : symbolName?.split(spreadRegex)?.[0];

    if (import.meta.env.DEV)
      console.log({ newTicker, symbolName, ticker, statementType, period, metric });

    try {
      if (spreadTickers.length > 1 && !isStatement) {
        const reducedResponse = await Promise.all(
          spreadTickers?.map(async (symbol) => {
            const response = await fetchQueryUdfSymbols({
              queryParams: {
                symbol: symbol.replace(/_/g, "-"),
              },
            }).then((data) => data);

            return response as LibrarySymbolInfo;
          }),
        );

        const hasEconomic = reducedResponse.some((x) => x.type === "economic");
        const otherTypes = reducedResponse.filter((x) => x.type !== "economic");
        if (hasEconomic && otherTypes?.length > 0) {
          return onError(
            `Economic data is not compatible with ${otherTypes?.map((x) => x.ticker)?.join(", ")}`,
          );
        }

        return onResolve(
          reducedResponse.reduce(
            (acc, item, index) => {
              const operation = operations[index - 1];

              item.ticker = item.ticker.replace(/-/g, "_");
              item.name = (item.name || item.ticker).replace(/-/g, "_");
              item.full_name = item.name;
              if (index === 0) {
                acc = item;
                acc.base_name = [item.name];
              }

              if (operation === "/") {
                acc.visible_plots_set = "c";
              }

              if (acc.type === "economic") {
                acc.visible_plots_set = "c";
                acc.pricescale = operation === "/" ? 1000000 : 100;
              }

              if (index === 0) return acc;

              acc.ticker = `${acc.ticker}${operation}${item.ticker}`;
              acc.base_name = acc.base_name.concat(item.name);

              for (const key of ["name", "symbol"]) {
                acc[key] = `${acc[key]}${operation}${item[key]}`;
              }

              acc.currency_code = `${acc.currency_code}/${item.currency_code}`;
              acc.description = `${acc.description}/${item.description}`;

              acc.visible_plots_set = acc.visible_plots_set || item.visible_plots_set;
              acc.supported_resolutions = Array.from(
                new Set(
                  acc.supported_resolutions
                    ? acc.supported_resolutions.concat(item.supported_resolutions)
                    : item.supported_resolutions,
                ),
              );
              acc.session = acc.session || item.session;
              acc.subsession_id = acc.subsession_id || item.subsession_id;
              acc.supported_resolutions = acc.supported_resolutions.map(
                (x) => x.replace("1M", "M") as ResolutionString,
              );

              return acc;
            },

            {} as LibrarySymbolInfo,
          ),
        );
      }

      fetchQueryUdfSymbols({
        queryParams: {
          symbol: newTicker.replace("_", "-"),
        },
      })
        .then(async (data: LibrarySymbolInfo & { symbol?: string }) => {
          data.ticker = data.ticker.replace(/-/g, "_");

          const trueSymbol = data?.ticker?.replace(/[\^$]/, "");

          data.name = trueSymbol;
          data.full_name = trueSymbol;
          data.symbol = trueSymbol;

          if (data.type === "economic") {
            data.visible_plots_set = "c";
            return onResolve(data);
          }
          data.has_empty_bars = false;

          if (!data) return onError("error");

          data.pricescale = data.pricescale === 1 ? 100 : data.pricescale;
          if (isStatement) {
            const indicatorSymbol = `${newTicker}-${statementType}-${period}-${metric}`;

            data.ticker = indicatorSymbol;
            data.name = indicatorSymbol;
            data.symbol = indicatorSymbol;
            data.has_intraday = false;
            data.type = "fundamental";
            data.currency_code = "USD";
            data.minmov = 1;
            data.description = `${newTicker} ${statementType.slice(0, 1).toUpperCase()}${statementType.slice(
              1,
            )} ${period.slice(0, 1).toUpperCase()}${period.slice(1)}`;
            data.pricescale = 1000000;
            data.session = "24x7";
          } else {
            if (data.session !== "24x7" && data.subsessions?.length) {
              data.session = data?.subsessions?.find(
                (x: { id: string }) => x.id === subsession_id,
              )?.session;
              data.subsession_id = extension?.session ? extension.session : "regular";
            }

            if (data?.supported_resolutions?.includes("60" as ResolutionString)) {
              data.intraday_multipliers = ["1", "5", "15", "30", "60"];
              data.supported_resolutions = data.supported_resolutions.concat([
                "120",
                "240",
              ] as ResolutionString[]);
            }
          }

          onResolve(data);
        })
        .catch(({ stack }) => {
          if (import.meta.env.DEV) console.error(stack);
          const response = stack?.response || stack;
          onError(response?.data?.detail || "error");
        });
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      onError("Error resolving symbol");
    }
  },
  getBars: async function getBars(
    this: ChartDataFeed,
    symbolInfo: LibrarySymbolInfo & { symbol?: string; errmsg?: string },
    resolution: ResolutionString,
    periodParams: PeriodParamsWithOptionalCountback,
    onHistoryCallback: HistoryCallback,
    onErrorCallback: ErrorCallback,
  ): Promise<void> {
    if (import.meta.env.DEV) console.log({ symbolInfo, resolution, periodParams });
    if (symbolInfo.errmsg) return onErrorCallback(symbolInfo.errmsg);
    symbolInfo.ticker = symbolInfo.ticker.replace(/\^SPX$/, "^GSPC");

    const chartId = this.getChartId();

    const [ticker, statementType, period, metric] = symbolInfo.ticker.split("-");
    const isStatement =
      ["income", "balance", "cashflow"].includes(statementType) && metric;
    const newTicker = isStatement ? ticker : symbolInfo.ticker?.split(spreadRegex)?.[0];

    const symbol = isStatement ? newTicker : symbolInfo.ticker;
    const realType = isStatement ? statementType : symbolInfo.type;

    // Modify how we split the symbol
    const spreadTickers = symbol.split(spreadRegex).filter((s) => s !== "");
    const operations = symbol.match(spreadRegex) || [];

    const statementSymbol = `${newTicker}-${statementType}-${period}`;
    const cacheKey = `${symbolInfo.symbol}_${chartId}`;

    if (periodParams.firstDataRequest || !cachedBars.has(cacheKey)) {
      this._keepFetching = true;
      cachedBars.set(cacheKey, new Set());
    }

    const { from, to } = periodParams;

    const interval = ["W", "M", "D"].includes(resolution.replace(/\d/g, ""))
      ? "1d"
      : Number.parseInt(resolution, 10) < 60
        ? `${resolution}m`
        : `${Number.parseInt(resolution, 10) / 60}h`;

    const statementParms = {
      symbol,
      period: period?.replace("ly", ""),
      limit: 10000,
      provider: "fmp",
    };

    const lastCandleTime =
      this._lastCandleTimestamp < 1
        ? dayjs().unix()
        : from < 1
          ? dayjs("1980-01-01").unix()
          : to;
    const newFrom =
      from < 1
        ? dayjs("1980-01-01").unix()
        : dayjs.unix(from).utc().subtract(1, "month").unix();
    const newTo = to < 1 ? lastCandleTime : to;

    const newStartDate = dayjs.unix(newFrom).utc().tz("America/New_York");
    const newEndDate = dayjs.unix(newTo).utc().tz("America/New_York");

    const defaultParams = {
      symbol: spreadTickers?.join(",")?.replace(/_/g, "-"),
      provider: "fmp",
      interval,
      start_date: newStartDate.format("YYYY-MM-DD"),
      end_date: newEndDate.format("YYYY-MM-DD"),
      sort: "asc",
    } as EquityPriceHistoricalQueryParams;

    const queryParams = {
      economic: {
        ...defaultParams,
        all_pages: true,
        provider: "intrinio",
        sleep: 0.5,
      },
      income: statementParms,
      balance: statementParms,
      cashflow: statementParms,
    } as Record<string, any>;

    const props = {
      symbolInfo,
      meta: { noData: false } as HistoryMetadata,
      onHistoryCallback,
      onErrorCallback,
      periodParams,
      from: newFrom,
    };

    queryParams[realType] = queryParams[realType] || defaultParams;

    try {
      if (
        savedStatements.has(statementSymbol) &&
        savedStatements.get(statementSymbol).s === "ok"
      ) {
        const bars = [] as Bar[];
        const data = savedStatements.get(statementSymbol).bars;

        for (const bar of data) {
          if (bar[metric] === null || bar[metric] === 0) continue;
          const value = bar[metric];

          bars.push({
            time: bar.time,
            close: value,
            open: value,
            high: value,
            low: value,
          });
        }

        if (bars.length === 0) {
          const metricName = metric
            .split("_")
            .map((x) => x[0].toUpperCase() + x.slice(1))
            .join(" ");
          return onErrorCallback(`No data for ${metricName}`);
        }

        return this.processGetBars({
          ...props,
          data: { s: "ok", bars },
        });
      }
      if (queryParams[realType]) {
        return getFetchFunc(realType)({
          queryParams: queryParams[realType],
        })
          .then(async ({ results }) => {
            const bars: Bar[] = [];

            // If there's more than one symbol, we need to perform calculations
            if (spreadTickers.length > 1 && !isStatement) {
              // Create a map to store data for each symbol
              const symbolData: Record<string, Record<number, Omit<Bar, "time">>> = {};

              // Process results for each symbol
              for (const item of results) {
                item.symbol = item.symbol.replace(/-/g, "_");

                const date = dayjs(item?.date || item?.period_ending);
                const time = date.unix();

                if (!symbolData[item.symbol]) {
                  symbolData[item.symbol] = {};
                }

                if (realType === "economic") {
                  if (item.value === null) continue;

                  const value = item.value || 0;
                  symbolData[item.symbol][time] = {
                    close: value,
                    open: value,
                    high: value,
                    low: value,
                  };
                  continue;
                }

                symbolData[item.symbol][time] = {
                  close: item.close,
                  open: item.open,
                  high: item.high,
                  low: item.low,
                };
              }

              // Align data points and perform calculations
              const timestamps = Object.keys(symbolData[spreadTickers?.[0]] || {}).map(
                Number,
              );

              for (const time of timestamps) {
                if (
                  spreadTickers.every((sym) => symbolData?.[sym]?.[time] !== undefined)
                ) {
                  if (!symbolData[spreadTickers[0]]?.[time]?.close) continue;
                  const bar = symbolData[spreadTickers[0]][time];

                  for (let i = 1; i < spreadTickers.length; i++) {
                    const operation = operations[i - 1];
                    for (const key of ["close", "open", "high", "low"]) {
                      if (!symbolData[spreadTickers[i]]?.[time]?.[key]) continue;
                      switch (operation) {
                        case "/":
                          bar[key] /= symbolData[spreadTickers[i]][time][key];
                          break;
                        case "+":
                          bar[key] += symbolData[spreadTickers[i]][time][key];
                          break;
                        case "-":
                          bar[key] -= symbolData[spreadTickers[i]][time][key];
                          break;
                        case "*":
                          bar[key] *= symbolData[spreadTickers[i]][time][key];
                          break;
                      }
                    }
                  }

                  if (!cachedBars.get(cacheKey)?.has(time)) {
                    bars.push({
                      time: time * 1000,
                      ...bar,
                    });
                    cachedBars.get(cacheKey).add(time);
                  }
                }
              }
            } else {
              for (let item of results) {
                const date = dayjs(item?.date || item?.period_ending);

                if (realType === "economic") {
                  if (item.value === null) continue;

                  const value = item.value || 0;
                  item = {
                    close: value,
                    open: value,
                    high: value,
                    low: value,
                  };
                }

                const hasOHLC = ["close", "open", "high", "low"].every((x) => item[x]);

                const time = date.unix();
                if (!isStatement && (!hasOHLC || time < newFrom || time > newTo))
                  continue;

                if (isStatement) {
                  const metricValue = item[metric];
                  item = {
                    ...item,
                    close: metricValue,
                    open: metricValue,
                    high: metricValue,
                    low: metricValue,
                  };
                }

                if (!cachedBars.get(cacheKey)?.has(time)) {
                  bars.push({ time: date.valueOf(), ...item });
                  cachedBars.get(cacheKey).add(time);
                }
              }
            }

            bars.sort((a: any, b: any) => a.time - b.time);

            if (isStatement) {
              const tickerTimes = cachedBars.get(`${ticker}_${chartId}`)?.values();
              const lastBarTime = tickerTimes ? Math.max(...tickerTimes) : null;
              if (lastBarTime) {
                bars.push({
                  ...bars[bars.length - 1],
                  time: dayjs.unix(lastBarTime).startOf("day").valueOf(),
                });
              }
            }

            const data = {
              s: bars.length === 0 ? "error" : ("ok" as "ok" | "error" | "no_data"),
              bars,
            };

            if (isStatement) {
              savedStatements.set(statementSymbol, data);
            }

            if (data.bars.length === 0 && periodParams.firstDataRequest) {
              this._keepFetching = false;
              return onErrorCallback("No data");
            }

            return this.processGetBars({ ...props, data });
          })
          .catch(async (error: Error & { stack: AxiosError<{ detail: string }> }) => {
            const response = error?.stack?.response;
            if (import.meta.env.DEV) {
              console.error(
                `[tvdf: getBars]: Get error: ${JSON.stringify(
                  response?.data?.detail || error.message,
                )}`,
              );
              console.error(error);
              console.log(response || error.message);
            }
            this.processGetBars({ ...props, data: { s: "error", bars: [] } });
          });
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      onErrorCallback("Failed to update bar");
    }
  },
  processGetBars: async function processGetBars(props: {
    symbolInfo: LibrarySymbolInfo;
    data: any;
    meta: HistoryMetadata;
    onHistoryCallback: HistoryCallback;
    onErrorCallback: ErrorCallback;
    periodParams?: PeriodParamsWithOptionalCountback;
    from?: number;
  }): Promise<void> {
    const { data, meta, onHistoryCallback, onErrorCallback, periodParams, from } =
      props;

    if (data?.s !== "ok" || data.bars.length === 0 || !this._keepFetching) {
      meta.noData = true;
      meta.nextTime = data?.nextTime;
      this._keepFetching = true;
      return onHistoryCallback([], meta);
    }

    if (from < 0 && !periodParams.firstDataRequest) {
      if (import.meta.env.DEV) console.log({ from, to: periodParams.to });

      this._keepFetching = false;
    }

    this.lastBar = data.bars[data.bars.length - 1];
    this._lastCandleTimestamp = data?.bars?.length
      ? Math.ceil(this.lastBar.time / 1000)
      : from;

    onHistoryCallback(data.bars, meta);
  },
  subscribeBars: function subscribeBars(
    this: ChartDataFeed,
    _symbolInfo: LibrarySymbolInfo,
    _resolution: ResolutionString,
    _onRealtimeCallback: SubscribeBarsCallback,
    subscriberId: string,
  ): void {
    this.subscriberId = subscriberId + this.getChartId();
    // wsTVChartService.subscribeBars(
    //   symbolInfo,
    //   resolution,
    //   onRealtimeCallback,
    //   subscriberId,
    //   this.chartId,
    //   this.lastBar,
    //   this._lastCandleTimestamp,
    // );
  },
  unsubscribeBars: function unsubscribeBars(_subscriberId: string): void {
    // wsTVChartService.unsubscribeBars(subscriberId, this.getChartId());
  },
  getTimescaleMarks: function getTimescaleMarks(
    symbolInfo: LibrarySymbolInfo,
    _from: number,
    _to: number,
    onDataCallback: GetMarksCallback<TimescaleMark>,
    resolution: ResolutionString,
  ): void {
    if (symbolInfo.type === "stock" && !["3M", "6M", "12M"].includes(resolution)) {
      fetchEquityFundamentalHistoricalEps({
        queryParams: {
          symbol: symbolInfo.ticker.replace(/_/g, "-"),
          provider: "fmp",
          limit: 15,
        },
      })
        .then(async ({ results }) => {
          function getKeys(obj: FMPHistoricalEps, date: dayjs.Dayjs) {
            const time = date.unix();
            const isTrue = obj.eps_actual > obj.eps_estimated;
            const color = isTrue ? "green" : obj.eps_actual ? "red" : "gray";
            const side = isTrue ? "Up" : obj.eps_actual ? "Down" : "";
            return { time, color, shape: `earning${side}`, label: "E" };
          }

          const timescale_marks = results
            .filter((item) => item.eps_estimated)
            .map((item) => {
              const date = dayjs(item.date).startOf("day");
              const surprise = round(item.eps_actual - item.eps_estimated, 2);
              const title = `Q${date.quarter()} ${date.format("YYYY-MM-DD")}`;
              return {
                id: `${item.date}-${item.symbol}`,
                ...getKeys(item, date),
                tooltip: [
                  `Earnings ${title}`,
                  `Expected: ${item.eps_estimated}`,
                  ...(item.eps_actual
                    ? [
                        `Actual: ${item.eps_actual}`,
                        surprise !== 0 ? `Surprise: ${surprise}` : "",
                      ]
                    : []),
                ],
              } as TimescaleMark;
            });

          onDataCallback(timescale_marks);
        })
        .catch((error) => {
          if (import.meta.env.DEV) console.error(error);
        });
    }
  },
  getServerTime: function getServerTime(cb: ServerTimeCallback): void {
    setTimeout(() => cb(dayjs().utc().unix()), 0);
  },
  getChartId: function getChartId(): string {
    return this.chartId;
  },
};

const DataFeed = (chartId: string) => {
  datafeed.subscriberId = "";
  datafeed.chartId = chartId;
  datafeed.getChartId = datafeed.getChartId.bind(datafeed);
  datafeed.subscribeBars = datafeed.subscribeBars.bind(datafeed);
  datafeed.unsubscribeBars = datafeed.unsubscribeBars.bind(datafeed);
  datafeed.getBars = datafeed.getBars.bind(datafeed);
  return datafeed;
};

export default DataFeed;
