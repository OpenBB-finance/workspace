import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogClose } from "@radix-ui/react-dialog";
import clsx from "clsx";
import DOMPurify from "dompurify";
import { lazy, type ReactNode, Suspense, useCallback, useMemo, useState } from "react";
import DraggableCard, { LoadingElement } from "~/components/DraggableCard";
import { InlineMath } from "~/components/Tex";
import { useWidgetContext } from "~/components/Widget.context";
import { useJsonData } from "~/lib/api";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { formatNumber, uuidv4 } from "~/lib/utils";
import { convertToReadableLabel } from "../General/Table/AgGridUtils";
import { useWidgetParamsPositions } from "../General/Table/NavBar/QueryParams";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import Dialog from "./Helpers/Dialog";

const MarkdownContent = lazy(() =>
  import("./custom/Markdown").then((module) => ({
    default: module.MarkdownContent,
  })),
);

const markdownOptions = {
  overrides: {
    latex: (props: { children?: string[] }) => {
      const childStr = props?.children?.[0] ?? "";
      // Sanitize LaTeX content
      const sanitizedLatex = DOMPurify.sanitize(childStr, {
        ALLOWED_TAGS: [], // Only allow text content
        ALLOWED_ATTR: [],
      });
      return <InlineMath math={sanitizedLatex} />;
    },
    a: {
      component: ({ children, href }: { children: ReactNode; href?: string }) => {
        // Only allow specific protocols in URLs
        const sanitizedHref =
          href?.startsWith("http") || href?.startsWith("https") ? href : "#";
        return (
          <a href={sanitizedHref} rel="noopener noreferrer" target="_blank">
            {children}
          </a>
        );
      },
    },
  },
  forceBlock: true,
  forceWrapper: true,
};

export function FileViewerWidget() {
  const { widget } = useWidgetContext();

  const options = useMemo(() => {
    const newParams = Object.fromEntries(
      Object.entries({
        ...(widget?.endpoint?.query ?? {}),
        ...(widget?.storage?.params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );

    return {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      method: widget.endpoint?.method ?? "GET",
      params: newParams,
    };
  }, [widget?.endpoint, widget?.storage?.params]);

  const { data, isLoading, error, dataUpdatedAt } = useJsonData(options, {
    enabled: true,
    staleTime: widget?.staleTime ?? 1000 * 60 * 15,
  });

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={true}
      lastUpdated={dataUpdatedAt}
      loading={isLoading}
      error={error || !data}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      errorMessage={widget?.external ? error?.message : "No results found"}
    >
      {data && data.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center">
          <span>No files available.</span>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-surface-divider overflow-y-auto">
          {data?.map((item: any, index: number) => (
            <FileDialog key={`file-dialog-${index}`} item={item} index={index} />
          ))}
        </ul>
      )}
    </DraggableCard>
  );
}

function formatValue(value: any) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return formatNumber(value, 2);
  }

  return JSON.stringify(value);
}

function FileDialog({ item, index }: { item: any; index: number }) {
  const [isOpen, setIsOpen] = useState(false);

  const trigger = useMemo(
    () => (
      <div
        key={`trigger-${index}`}
        title=""
        className={clsx("overflow-x-auto p-2 rounded", {
          "hover:bg-light-100 dark:hover:bg-[#212126] cursor-pointer": true,
        })}
      >
        <div className="flex items-center">
          <h3 className="font-bold underline text-brand-main dark:text-brand-lighter">
            {item?.title}
          </h3>
          {item?.description && (
            <span className="ml-2 text-light-500">{item.description}</span>
          )}
        </div>
        <div className="mt-2 flex items-start gap-2 overflow-x-auto">
          {Object.entries(item ?? {})
            .filter(
              ([key]) => key !== "title" && key !== "description" && key !== "link",
            )
            .map(([key, value]) => (
              <p key={key} className="font-semibold text-light-500">
                {convertToReadableLabel(key)}: {formatValue(value)}
              </p>
            ))}
        </div>
      </div>
    ),
    [item, index],
  );

  return (
    <Dialog
      open={isOpen}
      setOpen={setIsOpen}
      hideTitle={true}
      trigger={trigger}
      extraDialogClass="prose-sm text-xs! prose-p:my-1.5 p-2.5 pb-4 prose dark:prose-invert"
    >
      <FileContent item={item} setIsOpen={setIsOpen} />
    </Dialog>
  );
}

function FileContent(props: { item: any; setIsOpen: (isOpen: boolean) => void }) {
  const { widget, activeDashboardId } = useWidgetContext();
  const { item, setIsOpen } = props;
  const toggleSelectedWidget = useShallowCopilotDataStore(
    (state) => state.toggleSelectedWidget,
  );
  const addWidget = useShallowAppStore((state) => state.addWidget);
  const newURL = useMemo(() => {
    const url = new URL(widget.endpoint?.url);
    url.pathname = widget?.fileEndpoint ?? "";
    return url.toString();
  }, [widget.endpoint?.url, widget.fileEndpoint]);

  const fileLink = item?.link;
  const extension = fileLink.split(".").pop()?.toLowerCase() ?? "html";

  const { data, isLoading, error } = useJsonData(
    {
      url: newURL,
      endpointHeaders: widget.endpoint?.headers ?? {},
      method: widget.endpoint?.method ?? "GET",
      params: {
        path: fileLink,
        ...(widget?.storage?.params?.symbol && {
          symbol: widget.storage.params.symbol,
        }),
      },
    },
    {
      enabled: true,
      staleTime: widget?.staleTime ?? 1000 * 60 * 15,
    },
  );

  const createWidget = useCallback(
    (addToContext = false) => {
      const widgetToCreate = {
        id: uuidv4(),
        widgetId: "markdown",
        name: `${item.title} - markdown`,
        description: item.title,
        type: "custom",
        storage: { text: data },
        innerTab: widget?.innerTab,
      } as any;

      addWidget(activeDashboardId, widgetToCreate);
      addToContext && toggleSelectedWidget(widgetToCreate.id);
      setIsOpen(false);
    },
    [data, item.title, widget.innerTab, addWidget],
  );

  return (
    <>
      <div className="_dialog-header">
        <div className="flex items-start justify-between gap-10">
          <DialogPrimitive.Title asChild={true}>
            <p className="text-lg font-bold">{item.title}</p>
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {item.title}
          </DialogPrimitive.Description>
          <div className="flex gap-2 items-center mt-1">
            <Tooltip message="Open as a Widget on the Dashboard">
              <button tabIndex={-1} className="w-5 h-5" onClick={() => createWidget()}>
                <Icon id="copy-to-file" />
              </button>
            </Tooltip>
            <Tooltip message="Open as Widget and select it as context for Copilot">
              <button
                tabIndex={-1}
                className="w-5 h-5"
                onClick={() => createWidget(true)}
              >
                <Icon id="message-square-plus" />
              </button>
            </Tooltip>

            <Tooltip message="Close popup">
              <DialogClose tabIndex={-1}>
                <Icon id="cross-icon" className="h-5 w-5" />
              </DialogClose>
            </Tooltip>
          </div>
        </div>
      </div>
      {(isLoading || error) && (
        <div className="flex h-[calc(100%-38px)] w-full items-center justify-center">
          <LoadingElement loading={isLoading} errorMessage={error?.message} />
        </div>
      )}
      <div className="flex flex-col p-2.5 pb-4 prose dark:prose-invert max-w-none">
        {data && (
          <Suspense fallback={null}>
            <MarkdownContent extension={extension} content={data} />
          </Suspense>
        )}
      </div>
    </>
  );
}

export default FileViewerWidget;
