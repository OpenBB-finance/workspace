import { subscribeWithSelector } from "zustand/middleware";
import { createWithEqualityFn } from "zustand/traditional";
import { resultsToTicker } from "~/components/Widgets/Helpers/AdvancedSelectTicker";
import { fetchPostSymbols } from "../api/sdkComponents";
import type { FilterTypes, IgnoreTypes } from "../api/sdkSchemas";
import type { Ticker } from "../state/app";
import { ensureArray } from "../utils";

export type QueryTickersProps = {
  tickers: string | string[];
  filter?: FilterTypes | FilterTypes[];
  ignoreTypes?: IgnoreTypes | IgnoreTypes[];
  setCallback?: (tickers: Ticker[]) => void;
};

export type TickersState = {
  cachedTickers: Record<string, Ticker>;
  queryTickers: (props: QueryTickersProps) => Promise<Record<string, Ticker>>;
  getCachedTickers: (tickers: string | string[]) => Record<string, Ticker>;
  getOrQueryTickers: (
    tickers: string | string[],
    props?: Omit<QueryTickersProps, "tickers" | "setCallback"> & {
      setCallback?: (tickers: Ticker[]) => void;
    },
  ) => Promise<Record<string, Ticker>>;
};

async function callQuerySymbols(
  state: { cachedTickers: Record<string, Ticker> },
  props: QueryTickersProps,
) {
  const { tickers, filter, ignoreTypes } = props;

  const missing = Array.from(
    new Set(ensureArray(tickers).filter((ticker) => !state.cachedTickers[ticker])),
  );

  if (!missing?.length) {
    return ensureArray(tickers).reduce(
      (acc, ticker) => {
        acc[ticker] = state.cachedTickers[ticker];
        return acc;
      },
      {} as Record<string, Ticker>,
    );
  }

  const data = await fetchPostSymbols({
    body: {
      q: missing.join(","),
      ...(filter && { type: filter }),
      ...(ignoreTypes && { ignoreTypes }),
      limit: missing?.length,
    },
  }).catch((err) => {
    console.error("Error fetching symbols", err);
    return { results: [] };
  });

  return Object.fromEntries(
    resultsToTicker(data?.results).map((ticker) => [ticker.symbol, ticker]),
  );
}

export const createTickersStore = () => {
  return createWithEqualityFn<TickersState>()(
    subscribeWithSelector((set, get) => ({
      cachedTickers: {},
      queryTickers: async (props: QueryTickersProps) => {
        const { setCallback = null } = props;
        const newTickers = await callQuerySymbols(get(), props);

        if (setCallback) {
          setCallback([
            ...Object.values(newTickers),
            ...Object.values(get().cachedTickers),
          ] as Ticker[]);
        }

        set((state) => ({ cachedTickers: { ...state.cachedTickers, ...newTickers } }));

        return newTickers;
      },
      getCachedTickers: (tickers) =>
        ensureArray(tickers).reduce(
          (acc, ticker) => {
            if (!get().cachedTickers[ticker]) return acc;
            acc[ticker] = get().cachedTickers[ticker];
            return acc;
          },
          {} as Record<string, Ticker>,
        ),
      getOrQueryTickers: async (
        tickers: string[] | string,
        props: Omit<QueryTickersProps, "tickers" | "setCallback"> & {
          setCallback?: (tickers: Ticker[]) => void;
        } = {},
      ) => {
        const tickerArray = ensureArray(tickers);
        const state = get();

        // 1. Read from cache
        const cached = state.getCachedTickers(tickerArray);
        const cachedSymbols = Object.keys(cached);
        const missingSymbols = tickerArray.filter((t) => !cachedSymbols.includes(t));

        let fetched: Record<string, Ticker> = {};

        // 2. Fetch missing tickers
        if (missingSymbols.length) {
          const fetchProps = { ...props, tickers: missingSymbols };
          fetched = await callQuerySymbols(state, fetchProps);

          // 3. Merge into store
          set((s) => ({
            cachedTickers: { ...s.cachedTickers, ...fetched },
          }));
        }

        // 4. Combine all
        const allTickers = { ...cached, ...fetched };

        if (props.setCallback) {
          props.setCallback(Object.values(allTickers));
        }

        return allTickers;
      },
    })),
  );
};

export const tickersStore = createTickersStore();
