import { useQuery } from "@tanstack/react-query";

const PYTH_API_URL = "https://web-api.pyth.network/products_metadata?cluster=pythnet";

export interface PriceMetadata {
  attrs: {
    symbol: string;
    asset_type: string;
    base: string;
    description: string;
    display_symbol: string;
    generic_symbol?: string;
    quote_currency: string;
    schedule: string;
    cms_symbol?: string;
    country?: string;
    cqs_symbol?: string;
    nasdaq_symbol?: string;
    tenor?: string;
    contract_id?: string;
  };
  price_account_keys: string[];
}

export interface PriceMetadataResponse {
  [symbol: string]: PriceMetadata;
}

interface TransformedPriceMetadata {
  [symbol: string]: {
    feedId: string;
  };
}

export const usePythPriceMetadata = () => {
  return useQuery({
    queryKey: ["pyth-price-metadata"],
    queryFn: async (): Promise<TransformedPriceMetadata> => {
      const response = await fetch(PYTH_API_URL);
      if (!response.ok) {
        throw new Error("Failed to fetch Pyth price metadata");
      }
      const data = await response.json();
      const transformedData: TransformedPriceMetadata = {};

      Object.values(data).forEach((obj: PriceMetadataResponse) => {
        Object.values(obj).forEach((item: PriceMetadata) => {
          transformedData[item.attrs.symbol] = {
            feedId: item.price_account_keys[0],
          };
        });
      });

      return transformedData;
    },
    staleTime: 5 * 60 * 1000,
    // @ts-expect-error - ignored for now
    cacheTime: 30 * 60 * 1000,
  });
};
