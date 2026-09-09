import {
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
  type PriceData,
  type ProductData,
  type PythCluster,
  PythConnection,
} from "@pythnetwork/client";
import type { AccountUpdate } from "@pythnetwork/client/lib/PythConnection";
import { Connection, PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useState } from "react";
import { ensureAgGrid, useAgGridContext } from "~/components/General/Table/hooks";

export function usePriceChanges(priceFeeds: { symbol: string; feedId: string }[]) {
  const [_pythConnections, setPythConnections] = useState<PythConnection>(null);
  const { gridRef } = useAgGridContext();

  const onPriceChange = useCallback(
    (product: AccountUpdate<ProductData>, price: AccountUpdate<PriceData>) => {
      const productData = product.accountInfo.data.product;
      const priceData = price.accountInfo.data;

      if (!ensureAgGrid(gridRef.current)) return;

      const priceFeed = priceFeeds.find((feed) => feed.symbol === productData?.symbol);
      if (!priceFeed) return;

      const api = gridRef.current?.api;
      const rowData: Record<string, any> = api.getRowNode(productData?.symbol)?.data;

      if (
        !rowData ||
        typeof priceData.price !== "number" ||
        Number.isNaN(priceData.price)
      )
        return;

      const newData = { ...rowData };
      newData.price = priceData.price;
      newData.lastUpdated = Date.now();
      if (newData?.sparkline?.length)
        newData.sparkline[newData.sparkline.length - 1] = priceData.price;

      api.applyTransactionAsync({ update: [newData] });
    },
    [gridRef, priceFeeds],
  );

  const stopFeed = useCallback(() => {
    setPythConnections((prev) => {
      if (prev) {
        prev.stop();

        // @ts-expect-error
        const rpcWebSocket = prev.connection._rpcWebSocket;
        if (rpcWebSocket) {
          rpcWebSocket.removeAllListeners();
          rpcWebSocket.reconnect = false;

          if (rpcWebSocket.underlyingSocket) {
            rpcWebSocket.underlyingSocket.close();
          }
        }
      }
      return null;
    });
  }, []);

  const startFeed = useCallback(() => {
    if (!priceFeeds.length) return;
    stopFeed();

    setPythConnections((_prev) => {
      const PYTHNET_CLUSTER_NAME: PythCluster = "pythnet";
      const connection = new Connection(getPythClusterApiUrl(PYTHNET_CLUSTER_NAME));
      const pythPublicKey = getPythProgramKeyForCluster(PYTHNET_CLUSTER_NAME);

      const pythConnection = new PythConnection(
        connection,
        pythPublicKey,
        "confirmed",
        priceFeeds.map(({ feedId }) => new PublicKey(feedId)),
      );

      pythConnection.onPriceChangeVerbose(onPriceChange);
      pythConnection.start();

      return pythConnection;
    });
  }, [onPriceChange, priceFeeds, stopFeed]);

  useEffect(() => {
    return () => stopFeed();
  }, []);

  return startFeed;
}
