import isEqual from "lodash.isequal";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
} from "react";
import { useStoreWithEqualityFn } from "zustand/traditional";
import {
  type createTickersStore,
  type TickersState,
  tickersStore,
} from "../state/tickers";

type TickersStore = ReturnType<typeof createTickersStore>;
const TickersContext = createContext<TickersStore>(null);

export function useTickersContext<T = TickersState>(
  selector: (store: TickersState) => T = (store) => store as unknown as T,
  equalityFn: (a: T, b: T) => boolean = (prev, next) => isEqual(prev, next),
) {
  const store = useContext(TickersContext);

  if (!store) {
    throw new Error("useTickersContext must be used within a TickersProvider");
  }

  return useStoreWithEqualityFn(store, selector, equalityFn);
}

export function TickersProvider({ children }: { children: ReactNode }): ReactElement {
  const storeRef = useRef<TickersStore>();
  if (!storeRef.current) {
    storeRef.current = tickersStore;
  }

  const childrenMemo = useMemo(() => children, [children]);

  return (
    <TickersContext.Provider value={storeRef.current}>
      {childrenMemo}
    </TickersContext.Provider>
  );
}
