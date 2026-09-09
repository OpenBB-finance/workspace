import { useQuery } from "@tanstack/react-query";

interface HistoricalPrice {
  symbol: string;
  hour_price_diff_decimal: number;
  day_price_diff_decimal: number;
  week_price_diff_decimal: number;
  sparkline: number[];
}

type HistoricalPricesResponse = HistoricalPrice[];

const fetchHistoricalPrices = async (): Promise<HistoricalPricesResponse> => {
  const response = await fetch("https://benchmarks.pyth.network/v1/price_differences/");
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }
  return response.json();
};

export const useHistoricalPrices = () => {
  return useQuery<HistoricalPricesResponse, Error>({
    queryKey: ["historicalPrices"],
    queryFn: fetchHistoricalPrices,
    staleTime: 60000, // 1 minute
    refetchInterval: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });
};
