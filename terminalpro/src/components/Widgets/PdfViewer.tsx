import { useCallback, useEffect } from "react";
import DraggableCard, { SetLoadingOnResize } from "~/components/DraggableCard";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useJsonData } from "~/lib/api";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { type FileResponse, handleFileResponse } from "~/lib/utils";
import { useWidgetParamsPositions } from "../General/Table/NavBar/QueryParams";
import { useWidgetContext } from "../Widget.context";
import {
  type Highlight,
  PdfViewerCore,
  type QuoteBoundingBox,
} from "./Helpers/PdfViewerCore";

type PdfViewerState = {
  numPages: number;
  highlights?: Highlight[];
  pageScale?: { x: number; y: number };
};

export default function PdfViewer() {
  const { widget, updateWidget } = useWidgetContext();

  // Get values from widget storage with defaults
  const currentPage = (widget.storage?.page ?? 1) as number;
  const currentScale = (widget.storage?.scale ?? 1) as number;
  const currentQuoteBoundingBoxes = (widget.storage?.quoteBoundingBoxes ?? null) as
    | QuoteBoundingBox[][]
    | null;

  const currentChat = useShallowCopilotStore((state) => state.currentChat);

  const [state, dispatch] = useStateReducer<PdfViewerState>({
    numPages: 0,
    highlights: [],
    pageScale: { x: 1, y: 1 },
  });

  const {
    data: widgetData,
    isLoading,
    isError,
    dataUpdatedAt,
  } = useJsonData<FileResponse>(
    {
      url: widget.endpoint?.url ?? "",
      method: widget.endpoint?.method ?? "GET",
      params: widget.storage?.params,
      addBearerToken: widget.connectionType === "file",
      responseCb: (response, resolve) =>
        handleFileResponse(response, {
          filename: widget.name,
          defaultUrl: widget.endpoint?.url,
        }).then(resolve),
    },
    {
      staleTime: 1000 * 60 * 24 * 7,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      retryDelay: 1000,
    },
  );

  const clearQuoteBoundingBoxes = useCallback(() => {
    const numBoxes = currentQuoteBoundingBoxes?.length ?? 0;
    if (numBoxes > 0)
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          quoteBoundingBoxes: [],
        },
      }));
  }, [updateWidget, currentQuoteBoundingBoxes]);

  const onLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      dispatch({ numPages });
      clearQuoteBoundingBoxes();
    },
    [clearQuoteBoundingBoxes],
  );

  // Clear highlights when selected chat changes
  useEffect(clearQuoteBoundingBoxes, [currentChat]);
  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  useEffect(() => {
    const { pageScale } = state;
    const quoteBoundingBoxes = (currentQuoteBoundingBoxes ??
      []) as QuoteBoundingBox[][];
    const newHighlights = quoteBoundingBoxes
      .flatMap((quoteGroup) => {
        return quoteGroup.map((quote): Highlight | null => {
          const { page: pageNumber, x0, top: y0, x1, bottom: y1 } = quote;
          if (pageNumber !== currentPage) return null;
          const x = x0 * pageScale.x;
          const y = y0 * pageScale.y;
          const width = (x1 - x0) * pageScale.x;
          const height = (y1 - y0) * pageScale.y;
          return { x, y, width, height };
        });
      })
      .filter(Boolean) as Highlight[];
    dispatch({ highlights: newHighlights });
  }, [state.pageScale, currentQuoteBoundingBoxes, currentPage]);

  return (
    <DraggableCard
      extraClassName="p-0! flex"
      error={isError}
      loading={isLoading}
      lastUpdated={dataUpdatedAt}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      aiEnabled={true}
      aiData={widgetData?.aiData}
    >
      <SetLoadingOnResize>
        <PdfViewerCore
          file={widgetData?.objectUrl ?? null}
          currentPage={currentPage}
          currentScale={currentScale}
          onLoadSuccess={onLoadSuccess}
          setPageScale={(pageScale) => dispatch({ pageScale })}
          showPageNavigation={true}
          showZoomControls={true}
          showPageThumbnails={false}
          showSearch={true}
          highlights={state.highlights}
        />
      </SetLoadingOnResize>
    </DraggableCard>
  );
}
