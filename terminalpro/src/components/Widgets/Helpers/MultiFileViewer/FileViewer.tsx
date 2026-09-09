import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { pdfjs } from "react-pdf";
import { useWidgetContext } from "~/components/Widget.context";
import { type QuoteBoundingBox, useShallowCopilotStore } from "~/lib/state/copilot";
import { type Highlight, LoadingElement, PdfViewerCore } from "../PdfViewerCore";

export interface FileViewerItem {
  name: string;
  type?: string;
  fileType?: "pdf";
}

interface FileViewerProps {
  fileName: string;
  dataType?: string;
  objectUrl?: string;
  isLoading?: boolean;
}

export function FileViewer(props: FileViewerProps) {
  const { fileName, dataType, objectUrl, isLoading } = props;
  // Clear highlights when selected chat changes
  const currentChat = useShallowCopilotStore((state) => state.currentChat);
  const { widget, updateWidget } = useWidgetContext();
  const hasMounted = useRef(false);
  // Get values from widget file storage with defaults
  const currentFileName = (widget.storage?.currentFileName ?? null) as string;
  const fileStorage = widget.storage?.[fileName];
  const currentPage = (fileStorage?.page ?? 1) as number;
  const currentScale = (fileStorage?.scale ?? 1) as number;
  const currentQuoteBoundingBoxes = (fileStorage?.quoteBoundingBoxes ?? null) as
    | QuoteBoundingBox[][]
    | null;
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [pageScale, setPageScale] = useState<{
    x: number;
    y: number;
  }>({
    x: 1,
    y: 1,
  });
  const clearQuoteBoundingBoxes = useCallback(() => {
    const numBoxes = currentQuoteBoundingBoxes?.length ?? 0;
    if (numBoxes > 0)
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          [fileName]: {
            ...(prev.storage?.[fileName] ?? {}),
            quoteBoundingBoxes: [],
          },
        },
      }));
  }, [updateWidget, currentQuoteBoundingBoxes]);

  const onPageChange = useCallback(
    (page: number) => {
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          [fileName]: {
            ...(prev.storage?.[fileName] ?? {}),
            page: page,
          },
        },
      }));
    },
    [updateWidget, fileName],
  );

  const onScaleChange = useCallback(
    (scale: number) => {
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          [fileName]: {
            ...(prev.storage?.[fileName] ?? {}),
            scale: scale,
          },
        },
      }));
    },
    [updateWidget, fileName],
  );

  const onPageRenderSuccess = useCallback(
    ({
      page,
      canvasRef,
    }: {
      page: pdfjs.PDFPageProxy;
      canvasRef: RefObject<HTMLCanvasElement>;
    }) => {
      const originalViewport = page.getViewport({ scale: 1 });
      const xScale = canvasRef.current.clientWidth / originalViewport.width;
      const yScale = canvasRef.current.clientHeight / originalViewport.height;
      setPageScale({
        x: xScale,
        y: yScale,
      });
    },
    [],
  );

  useEffect(() => {
    if (!currentFileName) return;
    if (fileName !== currentFileName) return;
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
    setHighlights(newHighlights);
  }, [pageScale, currentFileName, fileName, currentPage, currentQuoteBoundingBoxes]);

  useEffect(() => {
    if (hasMounted.current) clearQuoteBoundingBoxes();
    else hasMounted.current = true;
  }, [currentChat]);

  // Get values from widget file storage with defaults
  if (!fileName) {
    return (
      <div className="flex items-center justify-center h-full">
        No file selected, please select a file to view.
      </div>
    );
  }

  if (isLoading) return <LoadingElement />;

  if (dataType === "pdf")
    return (
      <PdfViewerCore
        file={objectUrl || null}
        currentPage={currentPage}
        currentScale={currentScale}
        onPageChange={onPageChange}
        onScaleChange={onScaleChange}
        setPageScale={setPageScale}
        showPageThumbnails={false}
        showSearch={true}
        toolbarStartInset={true}
        highlights={highlights}
      />
    );

  if (!dataType) {
    return <div className="text-center">File Not Found</div>;
  }
  return <div className="text-center">Unsupported data type: {dataType}</div>;
}
