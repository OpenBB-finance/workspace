import get from "lodash/get";
import type { MouseEvent } from "react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import DraggableCard from "~/components/DraggableCard";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import Icon from "~/components/Icon";
import { DecreaseFontSizeIcon, IncreaseFontSizeIcon } from "~/components/Icons";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useJsonData } from "~/lib/api";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import { cn, formatDate, uuidv4 } from "~/lib/utils";
import { MarkdownContent } from "./Markdown";

type NewsData = {
  title: string;
  excerpt: string;
  date: string;
  author: string;
  body: string;
};

export default function CustomNews() {
  const { widget } = useWidgetContext();

  const validEndpoint = !!widget?.endpoint?.url;

  const [state, dispatch] = useStateReducer({
    failingUrl: undefined as undefined | string,
    fontSize: 14,
  });

  const options = useMemo(() => {
    const endpoint = widget.endpoint;
    const newParams = Object.fromEntries(
      Object.entries({
        ...(widget?.endpoint?.query ?? {}),
        ...(widget?.storage?.params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );

    return {
      url: endpoint?.url,
      endpointHeaders: endpoint?.headers ?? {},
      method: endpoint?.method ?? "GET",
      params: newParams,
      addBearerToken: false,
    };
  }, [widget?.endpoint, widget?.storage?.params]);

  const [popupArticle, setPopupArticle] = useState<NewsData | null>(null);

  const { data, isLoading, error, dataUpdatedAt } = useJsonData(
    {
      ...options,
      responseCb: async (data, resolve) => {
        const dataKey = widget?.data?.dataKey;

        const jsonData = await data.json();
        return resolve(get(jsonData, dataKey, jsonData));
      },
    },
    {
      enabled: validEndpoint,
      staleTime: widget?.staleTime ?? 1000 * 60 * 15,
    },
  );

  const [searchQuery, setSearchQuery] = useState("");

  const filteredArticles = useMemo(() => {
    if (!data) return [];
    if (!searchQuery) return data;

    const query = searchQuery.toLowerCase();
    return data.filter(
      (article) =>
        article.title.toLowerCase().includes(query) ||
        article.excerpt.toLowerCase().includes(query),
    );
  }, [data, searchQuery]);

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={data}
      elementNextToTitle={
        <Input
          size="xs"
          className="obb-parameter h-5 py-0"
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(value: string) => setSearchQuery(value)}
        />
      }
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      lastUpdated={validEndpoint ? dataUpdatedAt : undefined}
      loading={isLoading}
      error={error || !data}
      errorMessage={widget?.external ? error?.message : "No results found"}
      extraClassName="flex flex-col divide-y divide-surface-divider"
      //extraClassName="prose-sm text-xs! prose-p:my-1.5 p-2.5 pb-4 prose dark:prose-invert max-w-none"
    >
      <BaseDialog
        className="max-h-[80vh] lg:max-w-3xl xl:max-w-5xl"
        open={!!popupArticle}
        onClose={() => setPopupArticle(null)}
      >
        {popupArticle && (
          <DialogContent
            article={popupArticle}
            fontSize={state.fontSize}
            onFontSizeChange={(size) => dispatch({ fontSize: size })}
            innerTab={widget?.innerTab}
            closeDialog={() => setPopupArticle(null)}
          />
        )}
      </BaseDialog>
      {filteredArticles.map((article, index) => {
        return (
          <div
            key={`${article.date}-${index}`}
            onClick={() => setPopupArticle(article)}
            className="py-2 first:pt-0 cursor-pointer"
          >
            <div
              className={cn(
                "overflow-x-auto p-0.5 rounded text-xs flex flex-col gap-2 text-left hover:bg-light-100 dark:hover:bg-[#212126]",
              )}
            >
              {article.excerpt?.length > 10 ? (
                <Tooltip message={article.excerpt} className="max-w-[300px]">
                  <p className="font-semibold underline text-brand-main dark:text-brand-lighter w-fit">
                    {article.title}
                  </p>
                </Tooltip>
              ) : (
                <p className="font-semibold underline text-brand-main dark:text-brand-lighter">
                  {article.title}
                </p>
              )}
              <div className="flex items-center gap-2 text-light-500 dark:text-[#A2A2A2]">
                <span>{formatDate(new Date(article.date))}</span>
                <span>•</span>
                <span>{article.author}</span>
              </div>
            </div>
          </div>
        );
      })}
    </DraggableCard>
  );
}

interface DialogContentProps {
  article: NewsData;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  innerTab: string;
  closeDialog: () => void;
}

interface ExternalLinkProps {
  href?: string;
  children: ReactNode;
}

function ExternalLinkWithWarning({ href, children }: ExternalLinkProps) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [showWarning, setShowWarning] = useState(false);
  const sanitizedHref =
    href?.startsWith("http") || href?.startsWith("https") ? href : "#";
  const lastInnerTab = useShallowAppStore((state) => state?.getLastInnerTab(id));
  const innerTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab || "",
    [lastInnerTab, searchParams.get("tab")],
  );

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowWarning(true);
  };

  const handleProceed = () => {
    window.open(sanitizedHref, "_blank", "noopener,noreferrer");
    setShowWarning(false);
  };

  return (
    <>
      <a
        href={sanitizedHref}
        onClick={handleClick}
        className="obb-hyper-link transition-colors"
      >
        {children}
      </a>

      <BaseDialog open={showWarning} onClose={() => setShowWarning(false)}>
        <DialogTitle>External Link Warning</DialogTitle>
        <DialogDescription>
          <span>You are about to visit an external website:</span>
          <br />
          <span className="obb-hyper-link break-all">{sanitizedHref}</span>
          <br />
          <span>Are you sure you want to proceed?</span>
        </DialogDescription>
        <DialogFooter className="flex justify-between">
          <DialogClose asChild={true}>
            <Button variant="outlined" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <div className="flex gap-2 items-center">
            <Button variant="secondary" size="sm" onClick={handleProceed}>
              Proceed
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const widget = {
                  id: uuidv4(),
                  widgetId: "iframe",
                  name: "Website",
                  description: "Website",
                  storage: {
                    html: sanitizedHref,
                  },
                } as any;
                useAppStore.getState().addWidget(id, { ...widget, innerTab });
                setShowWarning(false);
              }}
            >
              Open as Website Widget
            </Button>
          </div>
        </DialogFooter>
      </BaseDialog>
    </>
  );
}

function DialogContent({
  article,
  fontSize,
  onFontSizeChange,
  innerTab,
  closeDialog,
}: DialogContentProps) {
  const { id } = useParams();
  const customOverrides = useMemo(
    () => ({
      a: {
        component: ExternalLinkWithWarning,
      },
    }),
    [],
  );

  const createNote = useCallback(() => {
    const widgetToCreate = {
      id: uuidv4(),
      widgetId: "rich_note",
      name: article.title,
      description: article.excerpt,
      type: "custom",
      storage: { html: article.body },
      innerTab: innerTab,
    } as any;

    useAppStore.getState().addWidget(id, widgetToCreate);
    closeDialog();
  }, [article, innerTab, id, closeDialog]);

  return (
    <>
      <div className="flex justify-between items-center pr-7 gap-2">
        <DialogTitle className="pr-0">{article.title}</DialogTitle>
        <Tooltip message="Open as a Widget on the Dashboard">
          <button
            tabIndex={-1}
            onClick={createNote}
            className="BB-Button inline-flex items-center justify-center gap-2 rounded-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-4 disabled:pointer-events-none transition cursor-pointer border border-general-border-primary text-ds-text-subtitle hover:border-general-border-primary hover:text-ds-text-heading focus-visible:ring-general-border-secondary disabled:border-general-border-disabled disabled:text-general-label-disabled body-sm-medium aspect-square p-0 h-5 w-5 border-none"
          >
            <Icon id="copy-to-file" className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
      <DialogDescription className="sr-only">{article.excerpt}</DialogDescription>
      <div className="flex gap-4 items-center mt-4">
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFontSizeChange(fontSize - 1);
            }}
            className="p-1 border-light-300 rounded border dark:border-light-600"
          >
            <DecreaseFontSizeIcon />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFontSizeChange(fontSize + 1);
            }}
            className="p-1 border-light-300 rounded border dark:border-light-600"
          >
            <IncreaseFontSizeIcon />
          </button>
        </div>
        <p className="text-light-500 dark:text-light-400 whitespace-nowrap">
          {formatDate(new Date(article.date))}
        </p>
        <p className="text-light-500 dark:text-light-400 whitespace-nowrap">
          Author:{" "}
          <span className="text-brand-main dark:text-brand-lighter">
            {article.author}
          </span>
        </p>
      </div>
      <div
        className="_article prose dark:prose-invert max-w-none overflow-y-auto"
        style={{ fontSize: `${fontSize}px` }}
      >
        <MarkdownContent content={article.body} customOverrides={customOverrides} />
      </div>
    </>
  );
}
