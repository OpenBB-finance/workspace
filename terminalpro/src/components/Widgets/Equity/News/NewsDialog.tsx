import { keepPreviousData } from "@tanstack/react-query";
import parse from "html-react-parser";
import { type ReactNode, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { DialogClose } from "~/components/ds/dialogs/Dialog";
import Icon from "~/components/Icon";
import { DecreaseFontSizeIcon, IncreaseFontSizeIcon } from "~/components/Icons";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import { useQueriesEquityPriceQuote } from "~/lib/api/sdkQueries";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { formatDate } from "~/lib/utils";
import Dialog from "../../Helpers/Dialog";
import TickerInfo from "../../Helpers/TickerInfo";
import NewsDropdownAction from "./NewsDropdownAction";
import type { NewsData, SnapShot } from "./useNewsStockData";

export default function NewsDialog({
  singleNews,
  trigger = null,
  setOpenModalTitle,
}: {
  singleNews: NewsData;
  trigger?: ReactNode;
  setOpenModalTitle: (title: string) => void;
}) {
  const [state, dispatch] = useStateReducer({
    dialog: false,
    invalidTickerInfos: [] as string[],
    fontSize: 14,
    hasOpened: false,
  });

  const handleDialogClose = useCallback(() => {
    if (setOpenModalTitle) {
      setOpenModalTitle("");
    }
  }, [setOpenModalTitle]);

  const setOpen = useCallback(
    (dialog: boolean) => {
      if (singleNews?.stocks?.length > 20 && !state.hasOpened) {
        dispatch({ hasOpened: true });
        setTimeout(() => dispatch({ dialog }), 300);
        return;
      }

      dispatch((prev) => ({
        ...prev,
        dialog,
        ...(!prev.hasOpened && { hasOpened: true }),
      }));
    },
    [singleNews?.stocks, state.hasOpened],
  );

  const contentMemo = useMemo(
    () => (
      <NewsDialogContent
        singleNews={singleNews}
        state={state}
        dispatch={dispatch}
        setOpenModalTitle={setOpenModalTitle}
      />
    ),
    [singleNews, state, dispatch, setOpenModalTitle],
  );

  return (
    <Dialog
      open={state.dialog}
      setOpen={setOpen}
      handleDialogClose={handleDialogClose}
      hideTitle={true}
      trigger={trigger}
      extraDialogClass="2xl:max-w-[1200px] lg:max-w-[990px] px-[30px]! py-[20px]! max-h-[80vh] overflow-y-auto"
    >
      {contentMemo}
    </Dialog>
  );
}

function NewsDialogContent(props: {
  singleNews: NewsData;
  setOpenModalTitle: (title: string) => void;
  state: any;
  dispatch: StateDispatch<any>;
}) {
  const { singleNews, state, dispatch, setOpenModalTitle } = props;

  const toggleSelectedWidget = useShallowCopilotDataStore(
    (state) => state.toggleSelectedWidget,
  );
  const addWidget = useAppStore((state) => state.addWidget);
  const { id } = useParams();
  const [searchParams, _] = useSearchParams();
  const lastInnerTab = useShallowAppStore((state) => state?.getLastInnerTab(id));
  const innerTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab || "",
    [lastInnerTab, searchParams.get("tab")],
  );

  const mainTicker = useWidgetContext(true)?.widget?.data?.mainTicker?.symbol || "";

  const textHtml = useMemo(
    () => singleNews?.text ?? singleNews?.teaser ?? "",
    [singleNews?.text, singleNews?.teaser],
  );

  const enableInArticle = useMemo(
    () =>
      !singleNews?.stocks?.every((stock: any) =>
        state.invalidTickerInfos.includes(stock),
      ),
    [singleNews?.stocks, state.invalidTickerInfos],
  );

  const handleDialogClose = useCallback(() => {
    if (setOpenModalTitle) {
      setOpenModalTitle("");
    }
  }, [setOpenModalTitle]);

  const needsSnapshot = useMemo(
    () =>
      Array.from(
        new Set(
          singleNews?.stocks
            ?.filter((snapshot) => !snapshot?.hasSnapshot)
            ?.map((stock) => stock?.symbol || stock) || [],
        ),
      ),
    [singleNews],
  );

  const snapshotResults = useQueriesEquityPriceQuote(
    {
      queryParams: {
        provider: "fmp",
        symbol: needsSnapshot.join(","),
      },
    },
    {
      enabled: state.hasOpened && needsSnapshot.length > 0,
      staleTime: 1000 * 60 * 5,
      placeholderData: keepPreviousData,
    },
  );

  const snapshotData = useMemo(
    () =>
      snapshotResults
        ?.filter((result) => result.data)
        ?.flatMap(
          ({ data }) =>
            data.results?.map((snapshot) => ({
              hasSnapshot: true,
              symbol: snapshot?.symbol,
              price: snapshot?.last_price,
              change: snapshot?.change,
              change_percent: snapshot?.change_percent * 100,
              volume: snapshot?.volume,
              day_range: [snapshot?.low, snapshot?.high],
              year_range: [snapshot?.year_low, snapshot?.year_high],
              market_cap: snapshot?.market_cap,
              exchange: snapshot?.exchange,
            })) as SnapShot[],
        ),

    [snapshotResults],
  );

  const inThisArticle = useMemo(() => {
    return singleNews?.stocks?.map((stock: any) => {
      const snapshot = snapshotData?.find(
        (snapshot) => snapshot?.symbol === stock?.symbol || snapshot?.symbol === stock,
      );

      return (
        <TickerInfo
          openOnClick={false}
          symbol={stock?.symbol || stock}
          key={stock?.symbol || stock}
          snapshot={{
            ...(stock?.hasSnapshot ? stock : snapshot),
            hasSnapshot: true,
          }}
          invalidTickerInfos={state.invalidTickerInfos}
          setInvalidTickerInfos={(invalidTickerInfos) =>
            dispatch({ invalidTickerInfos })
          }
        />
      );
    });
  }, [singleNews?.stocks, snapshotData, state.invalidTickerInfos]);

  return (
    <>
      <div className="_dialog-header">
        <div className="flex items-start justify-between gap-10">
          <p className="text-lg font-bold">{singleNews.title}</p>
          <div className="flex gap-2 items-center mt-1">
            {!id && (
              <NewsDropdownAction
                handleDialogClose={handleDialogClose}
                textHtml={textHtml}
                setDialog={(dialog) => dispatch({ dialog })}
                singleNews={singleNews}
                mainTicker={mainTicker}
              />
            )}
            {id ? (
              <Tooltip message="Open as Widget and select it as context for Copilot">
                <button
                  tabIndex={-1}
                  className="w-5 h-5"
                  onClick={() => {
                    const widget = {
                      id: uuidv4(),
                      widgetId: "single_news",
                      name: mainTicker ? `News - ${mainTicker}` : "News",
                      description: singleNews.title,
                      type: "custom",
                      storage: {
                        title: singleNews.title,
                        date: singleNews.date,
                        text: textHtml,
                        stocks: singleNews?.stocks?.map((stock: any) => stock.symbol),
                      },
                    } as any;
                    addWidget(id, { ...widget, innerTab });
                    toggleSelectedWidget(widget.id);
                    handleDialogClose();
                    dispatch({ dialog: false });
                  }}
                >
                  <Icon id="message-square-plus" />
                </button>
              </Tooltip>
            ) : (
              <NewsDropdownAction
                handleDialogClose={handleDialogClose}
                openCopilot={true}
                triggerIconId="message-square-plus"
                tooltipTriggerMessage="Open as a Widget on the Dashboard and select it as context for Copilot"
                textHtml={textHtml}
                setDialog={(dialog) => dispatch({ dialog })}
                singleNews={singleNews}
                mainTicker={mainTicker}
              />
            )}
            <Tooltip message="Close popup">
              <DialogClose tabIndex={-1}>
                <Icon id="cross-icon" className="h-5 w-5" />
              </DialogClose>
            </Tooltip>
          </div>
        </div>
        <div className="my-4 text-xs flex-col flex gap-8">
          <div className="flex justify-between gap-2 items-center">
            <div className="flex gap-4 items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => dispatch({ fontSize: (prev) => prev - 1 })}
                  className="p-1 border-light-300 rounded border dark:border-light-600"
                >
                  <DecreaseFontSizeIcon />
                </button>
                <button
                  onClick={() => dispatch({ fontSize: (prev) => prev + 1 })}
                  className="p-1 border-light-300 rounded border dark:border-light-600"
                >
                  <IncreaseFontSizeIcon />
                </button>
              </div>
              <p className="text-light-500 dark:text-light-400 whitespace-nowrap">
                {formatDate(new Date(singleNews?.date))}
              </p>
              <p className="text-light-500 dark:text-light-400 whitespace-nowrap">
                Partner:{" "}
                <span className="text-brand-main dark:text-brand-lighter">
                  Benzinga
                </span>
              </p>
            </div>
            {singleNews?.stocks?.length > 0 && (
              <div className="flex gap-2 text-light-500 dark:text-light-400 items-center">
                {enableInArticle && (
                  <span className="whitespace-nowrap">In this article:</span>
                )}
                <div className="flex gap-2 overflow-x-auto max-w-[300px]">
                  {inThisArticle}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className="_article prose dark:prose-invert max-w-none overflow-y-auto"
        style={{ fontSize: `${state.fontSize}px` }}
      >
        {parse(textHtml, {
          replace: (domNode: any) => {
            if (domNode.name === "a" && domNode.attribs?.class === "ticker") {
              const href = domNode.attribs?.href;
              if (href?.includes("https://www.benzinga.com/stock/")) {
                // example of href https://www.benzinga.com/stock/META#NASDAQ
                const symbol = href.split("/").pop()?.split("#")[0];
                if (symbol) {
                  const snapshot =
                    singleNews?.stocks?.find(
                      (stock: any) => stock?.symbol === symbol && stock?.hasSnapshot,
                    ) || snapshotData?.find((snapshot) => snapshot?.symbol === symbol);

                  if (snapshot) {
                    return (
                      <TickerInfo
                        openOnClick={false}
                        symbol={symbol}
                        key={symbol}
                        snapshot={{ ...snapshot, hasSnapshot: true }}
                        extraTriggerClass="text-sm"
                        inArticle={true}
                      />
                    );
                  }
                }
              }
            } else if (domNode.name === "a") {
              const href = domNode.attribs?.href;
              const text = domNode.children?.find((child: any) => child?.children?.[0])
                ?.children?.[0]?.data
                ? domNode.children?.find((child: any) => child?.children?.[0])
                    ?.children?.[0]?.data
                : domNode.children?.[0]?.data;

              return (
                <>
                  {/* needs the whitespace before && after or else the link will be attached to other words */}
                  {/* AKA: don't delete @colin99d */}{" "}
                  <ExternalLinkDialog key={href + text} href={href} text={text} />{" "}
                </>
              );
            }
          },
        })}
      </div>
    </>
  );
}

export const ExternalLinkDialog = ({ href, text }) => {
  return (
    <Dialog
      title="External Link"
      extraDialogClass="z-80 h-fit min-h-min"
      extraOverlayClass="z-60"
      actionBottomBar={{
        label: "I understand and wish to continue",
        onClick: () => {
          window.open(href, "_blank");
        },
      }}
      showBottomBar={true}
      trigger={<button className="obb-hyper-link">{text}</button>}
    >
      <div className="flex flex-col gap-2 my-4">
        <p className="text-sm">
          You are about to open an external link. Are you sure you want to continue?
        </p>
        <p className="text-xs">
          <span className="font-bold">URL:</span> {href}
        </p>
      </div>
    </Dialog>
  );
};
