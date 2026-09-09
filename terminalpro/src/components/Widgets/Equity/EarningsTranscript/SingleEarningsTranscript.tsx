import dayjs from "dayjs";
import { lazy, Suspense, useRef } from "react";
import DraggableCard from "~/components/DraggableCard";
import { useWidgetContext } from "~/components/Widget.context";
import { useEarningsTranscriptData, useSearchTranscript } from "./hooks";

const EarningsTranscriptContent = lazy(() =>
  import("./EarningsTranscript").then((module) => ({
    default: module.EarningsTranscriptContent,
  })),
);
export default function SingleEarningsTranscript() {
  const { widget } = useWidgetContext();

  const { symbol, earnings_date } = widget.storage ?? {};

  const {
    reducer: { state, dispatch },
    query: { isLoading, data, error, dataUpdatedAt },
  } = useEarningsTranscriptData({ symbol, earnings_date });

  const element = data?.results?.find((transcript) => {
    const trascriptDate = dayjs(transcript.date);
    return (
      trascriptDate.isSame(earnings_date, "day") ||
      trascriptDate.isSame(earnings_date, "week")
    );
  });
  const cardRef = useRef<HTMLDivElement>(null);
  const searchNavElement = useSearchTranscript({ state, dispatch, element, cardRef });

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={element?.content}
      ref={cardRef}
      lastUpdated={dataUpdatedAt}
      elementNextToTitle={searchNavElement}
      loading={isLoading}
      error={error}
      extraClassName="px-0!"
    >
      {element && (
        <Suspense fallback={null}>
          <EarningsTranscriptContent
            extraClassName="px-5"
            transcriptData={element}
            globalFilter={state.globalFilter}
            exactMatch={state.exactMatch}
          />
        </Suspense>
      )}
    </DraggableCard>
  );
}
