import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { AnimatePresence, motion } from "framer-motion";
import { useDebounceValue } from "usehooks-ts";
import { cn } from "~/components/ds/utils";
import BrandedLogo from "~/components/General/BrandedLogo";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type Highlight = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface PdfViewerCoreProps {
  file: string | { data: Uint8Array } | null;
  currentPage: number;
  currentScale: number;
  onPageChange?: (page: number) => void;
  onScaleChange?: (scale: number) => void;
  onLoadSuccess?: ({ numPages }: { numPages: number }) => void;
  setPageScale?: (scale: { x: number; y: number }) => void;
  showPageNavigation?: boolean;
  showZoomControls?: boolean;
  showPageThumbnails?: boolean;
  showSearch?: boolean;
  toolbarStartInset?: boolean;
  highlights?: Highlight[];
}

export type QuoteBoundingBox = {
  page: number;
  top: number;
  bottom: number;
  x0: number;
  x1: number;
};

export const LoadingElement = () => (
  <div className="flex h-full w-full items-center justify-center">
    <BrandedLogo className="mt-32" />
  </div>
);

export function PdfViewerCore({
  file,
  currentPage,
  currentScale,
  highlights = [],
  showPageNavigation = true,
  showZoomControls = true,
  showPageThumbnails = false,
  showSearch = true,
  toolbarStartInset = false,
  ...props
}: PdfViewerCoreProps) {
  const [numPages, setNumPages] = useState(0);
  const [visibleHighlights, setVisibleHighlights] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const updateWidget = useWidgetContext()?.updateWidget;

  const onPageRenderSuccess = useCallback(
    (page: pdfjs.PDFPageProxy) => {
      const originalViewport = page.getViewport({ scale: 1 });
      const xScale = canvasRef.current.clientWidth / originalViewport.width;
      const yScale = canvasRef.current.clientHeight / originalViewport.height;
      props.setPageScale({
        x: xScale,
        y: yScale,
      });
      setVisibleHighlights(true);
    },
    [props.setPageScale, canvasRef],
  );

  const onPageChange = useCallback(
    (page: number) => {
      if (props.onPageChange) return props.onPageChange(page);
      updateWidget?.((prev) => ({
        ...prev,
        storage: { ...prev.storage, page: page },
      }));
    },
    [props.onPageChange, updateWidget],
  );

  const onLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      props.onLoadSuccess?.({ numPages });
      // Preserve the current (persisted) page across document (re)loads, only
      // clamping it into range when it falls outside the document length.
      const clampedPage = Math.min(Math.max(currentPage, 1), numPages);
      if (clampedPage !== currentPage) onPageChange(clampedPage);
    },
    [props.onLoadSuccess, onPageChange, currentPage],
  );

  const onScaleChange = useCallback(
    (scale: number) => {
      if (props.onScaleChange) return props.onScaleChange(scale);
      updateWidget?.((prev) => ({ ...prev, storage: { ...prev.storage, scale } }));
    },
    [props.onScaleChange, updateWidget],
  );
  useEffect(() => setVisibleHighlights(false), [file]);

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full">
        No PDF file selected
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <div className="flex-1 flex flex-col h-full relative">
        {(showPageNavigation || showZoomControls || showSearch) && (
          <div
            className={cn(
              "my-2.5 flex items-center justify-center min-h-fit px-2",
              toolbarStartInset && "pl-12",
            )}
          >
            <div className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 dark:bg-dark-750 bg-light-50 rounded p-1">
              {(showPageNavigation || showZoomControls) && (
                <div className="flex min-w-fit max-w-full items-center justify-center overflow-x-auto">
                  {showPageNavigation && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Tooltip message="Previous Page">
                        <button
                          className="text-dark-50 hover:text-dark-200 disabled:text-light-200 disabled:hover:text-light-200 dark:text-dark-50 dark:hover:text-white dark:disabled:text-dark-500 dark:disabled:hover:text-dark-500"
                          onClick={() => {
                            if (currentPage <= 1) return;
                            onPageChange(currentPage - 1);
                          }}
                          disabled={currentPage <= 1}
                        >
                          <Icon id="chevron-left" className="w-4 h-4" />
                        </button>
                      </Tooltip>
                      <div className="flex items-center">
                        <input
                          min={1}
                          max={numPages}
                          value={currentPage}
                          className={cn(
                            "_pdf-page pl-2 text-light-600 dark:text-white dark:dark:bg-dark-600",
                            "bg-light-200 dark:border dark:border-dark-400 p-1 h-[22px] rounded mr-1",
                            {
                              "w-12": currentPage <= 50,
                              "w-[3.3rem]": currentPage > 50,
                            },
                          )}
                          type="number"
                          onChange={(e) => {
                            const value = Number.parseInt(e.target.value, 10);
                            if (!(value > 0 && value <= numPages)) return;
                            onPageChange(value);
                          }}
                        />
                        <p className="text-light-600 dark:text-white whitespace-nowrap">
                          / {numPages}
                        </p>
                      </div>
                      <Tooltip message="Next Page">
                        <button
                          className="text-dark-50 hover:text-dark-200 disabled:text-light-200 disabled:hover:text-light-200 dark:text-dark-50 dark:hover:text-white dark:disabled:text-dark-500 dark:disabled:hover:text-dark-500"
                          onClick={() => {
                            if (currentPage >= numPages) return;
                            onPageChange(currentPage + 1);
                          }}
                          disabled={currentPage >= numPages}
                        >
                          <Icon id="chevron-right" className="w-4 h-4" />
                        </button>
                      </Tooltip>
                    </div>
                  )}

                  {showPageNavigation && showZoomControls && (
                    <div className="obb-divider-vertical mx-3 min-h-[20px] shrink-0" />
                  )}

                  {showZoomControls && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Tooltip message="Zoom Out">
                        <button
                          className="text-dark-50 hover:text-dark-200 disabled:text-light-200 disabled:hover:text-light-200 dark:text-dark-50 dark:hover:text-white dark:disabled:text-dark-500 dark:disabled:hover:text-dark-500"
                          onClick={() => {
                            if (currentScale <= 0.2) return;
                            onScaleChange(currentScale - 0.1);
                          }}
                          disabled={currentScale <= 0.2}
                        >
                          <Icon id="minus-icon" className="w-6 h-6" />
                        </button>
                      </Tooltip>
                      <span className="flex items-center justify-center text-light-600 dark:text-white dark:dark:bg-dark-600 bg-light-200 dark:border dark:border-dark-400 py-0.5 px-1 w-fit h-[22px] rounded mr-1">
                        <span className="select-none! cursor-default!">
                          {Math.round(currentScale * 100)}%
                        </span>
                      </span>
                      <Tooltip message="Zoom In">
                        <button
                          className="text-dark-50 hover:text-dark-200 disabled:text-light-200 disabled:hover:text-light-200 dark:text-dark-50 dark:hover:text-white dark:disabled:text-dark-500 dark:disabled:hover:text-dark-500"
                          onClick={() => onScaleChange(currentScale + 0.1)}
                        >
                          <Icon id="plus-icon" className="w-6 h-6" />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </div>
              )}

              {showSearch && (
                <div className="flex w-[280px] max-w-full items-center justify-center">
                  <Search file={file} onPageChange={onPageChange} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="relative min-h-0 flex-1 w-full overflow-auto">
          <div className="min-w-fit flex justify-center items-center">
            <Document
              className="flex justify-center h-full w-full"
              loading={<LoadingElement />}
              file={file}
              externalLinkTarget="_blank"
              onLoadSuccess={onLoadSuccess}
            >
              <div className="relative">
                <Page
                  canvasRef={canvasRef}
                  loading={<LoadingElement />}
                  className="bg-transparent! flex h-full"
                  pageNumber={currentPage}
                  scale={currentScale}
                  onRenderSuccess={onPageRenderSuccess}
                />
                {visibleHighlights &&
                  highlights.map((highlight, index) => (
                    <div
                      key={index}
                      className="absolute bg-brand-lighter/30 rounded-sm"
                      style={{
                        left: `${highlight.x}px`,
                        top: `${highlight.y}px`,
                        width: `${highlight.width}px`,
                        height: `${highlight.height}px`,
                      }}
                    />
                  ))}
              </div>
            </Document>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to search PDF text
export function usePdfTextSearch(
  file: string | { data: Uint8Array } | null,
  searchString: string,
) {
  const [state, setState] = useState<{
    pages: string[];
    resultsList: number[];
  }>({
    pages: [],
    resultsList: [],
  });

  useEffect(() => {
    if (!file) return;

    let loadingTask: pdfjs.PDFDocumentLoadingTask;

    if (typeof file === "string") {
      loadingTask = pdfjs.getDocument({ url: file });
    } else {
      // create a copy of the Uint8Array to prevent detachment
      const dataCopy = new Uint8Array(file.data);
      loadingTask = pdfjs.getDocument({ data: dataCopy });
    }

    loadingTask.promise
      .then((docData) => {
        const pageCount = docData._pdfInfo.numPages;

        const pagePromises = Array.from({ length: pageCount }, (_, pageNumber) => {
          return docData.getPage(pageNumber + 1).then((pageData) => {
            return pageData.getTextContent().then((textContent) => {
              // @ts-expect-error
              return textContent.items.map(({ str }) => str).join(" ");
            });
          });
        });

        return Promise.all(pagePromises).then((pages) => {
          setState((prev) => ({ ...prev, pages }));
        });
      })
      .catch((error) => {
        console.error("Error loading PDF for text search:", error);
      });

    return () => {
      // prevent memory leaks
      loadingTask.destroy();
    };
  }, [file]);

  useEffect(() => {
    if (!searchString?.length) {
      setState((prev) => ({ ...prev, resultsList: [] }));
      return;
    }

    const regex = new RegExp(`${searchString}*`, "i");
    const updatedResults: number[] = [];

    state.pages.forEach((text, index) => {
      if (regex.test(text)) {
        updatedResults.push(index + 1);
      }
    });

    setState((prev) => ({ ...prev, resultsList: updatedResults }));
  }, [state.pages, searchString]);

  return state.resultsList;
}

function Search({
  file,
  onPageChange,
}: {
  file: string | { data: Uint8Array };
  onPageChange: (page: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounceQuery] = useDebounceValue(query, 700);
  const results = usePdfTextSearch(file, debounceQuery);
  const [isSearchResultVisible, setIsSearchResultVisible] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        inputRef.current &&
        !dropdownRef.current.contains(target) &&
        !inputRef.current.contains(target)
      ) {
        setIsSearchResultVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef, inputRef]);

  return (
    <div className="relative w-full max-w-[280px]">
      <input
        className="pl-2 text-light-600 dark:text-white dark:bg-dark-600 bg-light-200 dark:border dark:border-dark-400 p-1 h-[22px] rounded w-full"
        placeholder="Search"
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setIsSearchResultVisible(true);
          setQuery(e.target.value);
        }}
        onFocus={() => setIsSearchResultVisible(true)}
      />
      {isSearchResultVisible && (
        <AnimatePresence>
          {debounceQuery && (
            <motion.div
              ref={dropdownRef}
              className="absolute mt-1 z-50 w-[150px] p-3 dark:bg-dark-800 bg-light-50 rounded-md shadow-lg text-xs text-light-600 dark:text-light-400 border border-light-200 dark:border-dark-600"
              initial={{ opacity: 0, y: -10, scaleY: 0.9 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -10, scaleY: 0.9 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="flex justify-between items-center mb-2">
                <p className="font-medium">
                  Results: <span className="font-bold">{results.length}</span>
                </p>
                <button
                  className="text-light-500 hover:text-light-700 dark:text-dark-300 dark:hover:text-dark-100"
                  onClick={() => {
                    setQuery("");
                    setIsSearchResultVisible(false);
                  }}
                >
                  <Icon id="x" className="w-3 h-3" />
                </button>
              </div>

              <motion.div
                className="max-h-60 overflow-y-auto flex flex-col gap-1 bg-light-100/50 dark:bg-dark-700 text-light-500 dark:text-dark-100 p-2 rounded-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {results.length === 0 && (
                  <div className="text-2xs text-center py-2">
                    <strong>No results found</strong>
                    <p>We couldn't find a match for your search.</p>
                  </div>
                )}
                {results.map((result, index) => (
                  <motion.div
                    key={`page-result-${result}-${index}`}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <Tooltip message={"Click to navigate to page"} position="left">
                      <button
                        className="w-full text-left text-xs px-2 py-1.5 bg-light-100 dark:bg-dark-600 hover:bg-light-200 dark:hover:bg-dark-500 rounded flex justify-between items-center"
                        onClick={() => {
                          onPageChange(result);
                        }}
                      >
                        <span>Page {result}</span>
                        <Icon id="arrow-right" className="w-3 h-3" />
                      </button>
                    </Tooltip>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      )}{" "}
    </div>
  );
}
