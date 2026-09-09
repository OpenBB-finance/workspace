import dayjs from "dayjs";
import { jsPDF } from "jspdf";
import { useCallback, useEffect, useMemo, useRef } from "react";
import DraggableCard from "~/components/DraggableCard";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import { AdvancedSelect } from "~/components/NewAdvancedSelect";
import { useWidgetContext } from "~/components/Widget.context";
import type { FMPEarningsCallTranscriptData as EarningsCallTranscript } from "~/lib/api/sdkSchemas";
import { cn } from "~/lib/utils";
import AdvancedSelectedTicker from "../../Helpers/AdvancedSelectTicker";
import TickerInfo from "../../Helpers/TickerInfo";
import {
  getTranscriptInitialState,
  type TranscriptProps,
  useEarningsTranscriptData,
  useSearchTranscript,
} from "./hooks";
import { formatText } from "./utils";

const QUARTER_OPTIONS = [
  { label: "Q1", value: "Q1" },
  { label: "Q2", value: "Q2" },
  { label: "Q3", value: "Q3" },
  { label: "Q4", value: "Q4" },
];

function getLatestYear() {
  const date = dayjs();
  return date.quarter() >= 2 ? date.year() + 1 : date.year();
}

function getYearsList() {
  const date = dayjs();
  const currentYear = date.quarter() >= 2 ? date.year() + 1 : date.year();
  const subtract = date.quarter() > 2 ? 10 : 11;

  return Array.from(
    { length: subtract + 1 },
    (_, i) => currentYear - subtract + i,
  ).sort((a, b) => b - a);
}

export default function EarningsTranscript() {
  const { widget, updateWidget } = useWidgetContext();
  const cardRef = useRef<HTMLDivElement>(null);
  const changedYear = useRef(false);
  const changedQuarter = useRef(false);

  const yearsList = useMemo(() => getYearsList(), []);

  const selectedYear = widget.storage?.params?.year || getLatestYear();

  const {
    reducer: { state, dispatch },
    query: { isLoading, data: queryData, error, dataUpdatedAt, isFetched, isSuccess },
  } = useEarningsTranscriptData({
    symbol: widget.data?.mainTicker?.symbol,
    selectedQuarter: widget.storage?.params?.quarter || `Q${dayjs().quarter()}`,
    year: selectedYear,
  });

  const data = queryData?.results;

  const parsedQuarter = Number.parseInt(state.selectedQuarter.replace("Q", ""), 10);
  const element = data?.find((item) => item.quarter === parsedQuarter);

  const searchNavElement = useSearchTranscript({ state, dispatch, element, cardRef });

  const updateParams = useCallback(
    (params: Partial<TranscriptProps>) => {
      const { year, selectedQuarter } = params;

      updateWidget({
        ...widget,
        storage: {
          ...widget.storage,
          params: {
            ...(widget?.storage?.params ?? {}),
            year: year ?? state.year,
            quarter: selectedQuarter ?? state.selectedQuarter,
          },
        },
      });

      dispatch(params);
    },
    [widget, state.year, state.selectedQuarter, updateWidget, dispatch],
  );

  useEffect(() => {
    const symbol = widget.data?.mainTicker?.symbol;
    changedYear.current = false;
    changedQuarter.current = false;
    if (state.symbol === symbol) return;
    updateParams({
      ...getTranscriptInitialState(),
      symbol,
      year: yearsList[0],
      selectedQuarter: "Q4",
    });
  }, [widget.data?.mainTicker?.symbol]);

  useEffect(() => {
    if (isFetched) {
      dispatch({ updated: true });
    }
  }, [state.selectedQuarter]);

  useEffect(() => {
    if (changedYear.current) return;

    const currentYear = dayjs().year();
    if (error && [currentYear, currentYear + 1].includes(state.year)) {
      changedYear.current = state.year - 1 < currentYear + 1;
      changedQuarter.current = false;
      updateParams({ year: state.year - 1 });
    }
  }, [error]);

  useEffect(() => {
    if (changedQuarter.current) return;
    if (isSuccess && !element) {
      const quarters = data?.map((item) => item.quarter);

      if (!quarters?.includes(parsedQuarter) && quarters?.length) {
        changedQuarter.current = true;
        const maxQuarter = Math.max(...quarters);
        updateParams({ selectedQuarter: `Q${maxQuarter}` });
      }
    }
  }, [isSuccess, isFetched, element]);

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={element}
      ref={cardRef}
      lastUpdated={dataUpdatedAt}
      elementNextToTitle={searchNavElement}
      exportFns={{
        txtFunction: (title) => {
          console.log("Exporting as txt");
          const textData = `Date: ${dayjs(element.date)
            .tz("America/New_York")
            .format("MMM D, YYYY h:mm A")}\nTicker: ${element.symbol}\nFiscal Year: ${
            element.year
          }\nQuarter: ${element.quarter}\n\n${element.content}`;
          const textBlob = new Blob([textData], { type: "text/plain" });
          const textUrl = window.URL.createObjectURL(textBlob);
          const downloadLink = document.createElement("a");
          downloadLink.setAttribute("hidden", "");
          downloadLink.setAttribute("href", textUrl);
          downloadLink.setAttribute("download", `${title}.txt`);
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        },
        pdfFunction: async (title) => {
          console.log("Exporting as pdf");
          const doc = new jsPDF();

          const formattedDate = dayjs(element.date)
            .tz("America/New_York")
            .format("MMM D, YYYY h:mm A");
          const textData = `Date: ${formattedDate}\nTicker: ${element.symbol}\nFiscal Year: ${element.year}\nQuarter: ${element.quarter}\n\n${element.content}`;

          const margin = 10; // Margin for text from page borders
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          const maxWidth = pageWidth - margin * 2; // Calculate maximum text width
          const lineHeight = 10; // Approximate line height
          const lines = doc.splitTextToSize(textData, maxWidth); // Split text to fit page width
          let yPosition = margin; // Initial y position for text start

          lines.forEach((line, _index) => {
            if (yPosition + lineHeight > pageHeight - margin) {
              // Check if the line fits on the current page
              doc.addPage(); // Add a new page
              yPosition = margin; // Reset y position for the new page
            }
            doc.text(line, margin, yPosition); // Add text line at current position
            yPosition += lineHeight; // Move to the next line position
          });

          doc.save(`${title}.pdf`); // Save the PDF with the given title
        },
      }}
      elementRightNextToTitle={
        <>
          <AdvancedSelectedTicker triggerSize="sm" />
          <AdvancedSelect
            className="obb-parameter"
            popupWidth={100}
            label={state.year ? state.year.toString() : "Year"}
            selected={state.year || undefined}
            onSelect={(year) => updateParams({ year: Number(year) })}
            values={yearsList.map((y) => ({ label: y.toString(), value: y }))}
          />
          <AdvancedSelect
            className="obb-parameter"
            popupWidth={100}
            label={state.selectedQuarter}
            selected={state.selectedQuarter}
            onSelect={(value) => {
              if (value) updateParams({ selectedQuarter: String(value) });
            }}
            values={QUARTER_OPTIONS}
          />
        </>
      }
      loading={isLoading}
      extraClassName="px-0!"
    >
      {element ? (
        <EarningsTranscriptContent
          extraClassName="px-5"
          transcriptData={element}
          globalFilter={state.globalFilter}
          exactMatch={state.exactMatch}
          isWidget={true}
        />
      ) : error || (!element && isFetched) ? (
        <SearchResultsNotFound
          icon={true}
          firstMessage="Data not found"
          secondMessage={`No transcript found for ${widget.data?.mainTicker?.symbol}
            ${state.selectedQuarter} ${selectedYear}`}
        />
      ) : null}
    </DraggableCard>
  );
}

export function EarningsTranscriptContent({
  transcriptData,
  globalFilter,
  extraClassName = "",
  exactMatch = false,
  isWidget = false,
}: {
  transcriptData: EarningsCallTranscript;
  globalFilter: string;
  extraClassName?: string;
  exactMatch?: boolean;
  isWidget?: boolean;
}) {
  const { date, symbol, year, quarter, content } = transcriptData;
  return (
    <div className={cn("flex flex-col gap-2", extraClassName)}>
      <div className="flex gap-4 text-ds-text-caption items-center _widget-content">
        <p>{dayjs(date).tz("America/New_York").format("MMM D, YYYY h:mm A")}</p>
        {!isWidget && (
          <>
            <TickerInfo symbol={symbol} />
            <p>
              Fiscal Year: <span>{year}</span>
            </p>
            <p>
              Quarter: <span>{quarter}</span>
            </p>
          </>
        )}
      </div>
      <div className="text-sm">{formatText(content, globalFilter, exactMatch)}</div>
    </div>
  );
}
