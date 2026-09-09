import dayjs from "dayjs";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useEquityFundamentalTranscript } from "~/lib/api/sdkComponents";
import type { Ticker } from "~/lib/state/app";

export interface TranscriptProps {
  symbol?: string;
  year?: number;
  selectedQuarter?: string;
  earnings_date?: string;
}

export interface SingleTranscriptProps extends TranscriptProps {
  mainTicker: Ticker;
  transcriptData: any;
}

export function getTranscriptInitialState() {
  return {
    year: dayjs().year(),
    selectedQuarter: `Q${dayjs().quarter()}`,
    wordCount: 0,
    globalFilter: "",
    exactMatch: false,
    currentMatch: 0,
    updated: false,
  };
}

export function useEarningsTranscriptData({
  symbol,
  year = dayjs().year(),
  selectedQuarter = `Q${dayjs().quarter()}`,
  earnings_date,
}: TranscriptProps) {
  const [state, dispatch] = useStateReducer({
    ...getTranscriptInitialState(),
    symbol,
    year,
    selectedQuarter,
    earnings_date,
  });

  const queryContext = useEquityFundamentalTranscript(
    {
      queryParams: {
        provider: "fmp",
        symbol,
        year: state.year,
        ...(state.earnings_date && { earnings_date: state.earnings_date }),
      },
    },
    {
      enabled: true,
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  );

  return {
    reducer: { state, dispatch },
    query: queryContext,
  };
}
