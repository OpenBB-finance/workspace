import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { usePostHog } from "posthog-js/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ErrorBoundary } from "react-error-boundary";
import type { Layout } from "react-grid-layout";
import { useSearchParams } from "react-router-dom";
import { useLocalStorage, useOnClickOutside, useResizeObserver } from "usehooks-ts";
import { Input } from "~/components/ds/atoms/Input";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import GridLayout from "~/components/GridLayout";
import RenderIfVisible from "~/components/RenderIfVisible";
import { useWidgetContext, WidgetProvider } from "~/components/Widget.context";
import BigStories from "~/components/Widgets/Equity/News/BigStories";
import News from "~/components/Widgets/Equity/News/News";
import TopBarOverview from "~/components/Widgets/Equity/TopBarOverview";
import RSSViewer from "~/components/Widgets/RssViewer";
import { RSS_FEEDS } from "~/lib/constants";
import { TabProvider } from "~/lib/contexts/TabContext";
import type { Widget } from "~/lib/state/app";
import { getFromLS } from "~/lib/utils";
import { INDICES } from "~/seeds/randomSeed";
import Icon from "../components/Icon";

const NEWS_LAYOUT_KEY = "rgl-menu-news-8";

const INITIAL_LAYOUT = [
  { i: "a", x: 0, y: 0, w: 40, h: 4 },
  { i: "b", x: 0, y: 4, w: 40, h: 1, isResizable: false },
  { i: "c", x: 0, y: 5, w: 40, h: 7 },
  { i: "d", x: 0, y: 12, w: 20, h: 17 },
  { i: "e", x: 20, y: 12, w: 20, h: 17 },
];

type CategoryT = {
  label: string;
  channel: string;
};
type selectedChannel = {
  main: {
    label: string;
    channel: string;
    subCategories: CategoryT[];
  };
  sub: CategoryT;
} | null;

export default function NewsPageWrapper() {
  const posthog = usePostHog();
  return (
    <ErrorBoundary
      onError={(error, info) => {
        console.error(error);
        if (posthog) {
          posthog.capture("error_news_page", {
            info: info.componentStack,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          });
        }
      }}
      fallback={
        <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-light-300/40 bg-white p-2 dark:bg-light-850">
          <SearchResultsNotFound
            firstMessage="Something went wrong"
            secondMessage="Please try again later"
          />
        </div>
      }
    >
      <NewsPage />
    </ErrorBoundary>
  );
}

const ROW_HEIGHT = 20;
const MARGIN = 10;

export function NewsPage() {
  const [openModalTitle, setOpenModalTitle] = useLocalStorage("open-news", "");
  const [params, setParams] = useSearchParams();
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const size = useResizeObserver({
    ref,
    box: "border-box",
  });

  const [selectedFeeds] = useLocalStorage("news-feeds", RSS_FEEDS);
  const [marketIndices] = useLocalStorage("news-market-indices", INDICES);

  const [selectedChannel, setSelectedChannel] = useState<selectedChannel>(() => {
    // Get selected channel from url params, main=label&sub=label
    const main = params.get("main") || localStorage.getItem("news-main");
    const sub = params.get("sub") || localStorage.getItem("news-sub");

    if (!(main && sub)) return null;

    const mainCategory = NEWS_TYPES.find((category) => category.label === main);

    if (!mainCategory) return null;

    const subCategory = mainCategory.subCategories.find(
      (category) => category.label === sub,
    );

    if (!subCategory) return null;

    return {
      main: mainCategory,
      sub: subCategory,
    };
  });

  const [layouts, setLayouts] = useState<Layout[]>(
    getFromLS(NEWS_LAYOUT_KEY, "layout", {
      layout: INITIAL_LAYOUT,
    }),
  );

  const isMobile = useMemo(() => {
    return size?.width < 768;
  }, [size]);

  const remainingHeight = useMemo(() => {
    if (size?.height > 800) {
      const totalGridHeight = size.height / (ROW_HEIGHT + MARGIN);
      const fixedHeightForABC = 12;
      const remainingHeight = totalGridHeight - fixedHeightForABC;

      return Math.floor(remainingHeight) - 1;
    }
    return 17;
  }, [size]);

  useEffect(() => {
    localStorage.setItem("news-main", selectedChannel?.main?.label);
    localStorage.setItem("news-sub", selectedChannel?.sub?.label);
    if (selectedChannel) {
      setParams({
        main: selectedChannel.main.label,
        sub: selectedChannel.sub.label,
      });
    } else {
      setParams({});
    }
  }, [selectedChannel, setParams]);

  const _resetLayout = () => {
    setLayouts(INITIAL_LAYOUT);
  };

  useEffect(() => {
    if (!openModalTitle) return;
    const timer = setTimeout(() => {
      document.querySelector<HTMLElement>(`._${openModalTitle}`)?.click();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const rssFeedWidget = {
    id: "rss",
    widgetId: "rss_viewer",
    storage: {
      feeds: selectedFeeds,
      disableAI: true,
    },
  } as any;

  const rssFeedContext = useWidgetContext(true, {
    widget: rssFeedWidget,
    updateWidget: (widget: Widget) => {
      localStorage.setItem("news-feeds", JSON.stringify(widget.storage.feeds));
    },
    widgetRef: { current: rssFeedWidget },
    getWidget: () => rssFeedWidget as any,
  });

  const overViewWidget = {
    id: "a",
    widgetId: "market_indices",
    name: " ",
    storage: {
      securities: marketIndices,
    },
  } as any;

  const overViewContext = useWidgetContext(true, {
    widget: overViewWidget,
    updateWidget: (widget: Widget) => {
      localStorage.setItem(
        "news-market-indices",
        JSON.stringify(widget.storage.securities),
      );
    },
    widgetRef: { current: overViewWidget },
    getWidget: () => overViewWidget as any,
  });

  return (
    <TabProvider layouts={layouts} currentTab="news" tabId="news">
      <div ref={(r) => (ref.current = r)} className="h-full">
        <GridLayout
          saveToLocalStorage={true}
          localStorageKey={NEWS_LAYOUT_KEY}
          rowHeight={ROW_HEIGHT}
          extraClassName="lg:mx-3"
        >
          <div key="a">
            <WidgetProvider contextOverride={overViewContext}>
              <RenderIfVisible>
                <TopBarOverview showEllipsisMenu={false} showClose={false} />
              </RenderIfVisible>
            </WidgetProvider>
          </div>
          <div
            key="menu"
            data-grid={{
              x: 0,
              y: 1,
              w: 40,
              h: selectedChannel ? 3 : 2,
              isResizable: false,
            }}
            className={clsx(
              "react-resizable-hide flex h-full w-full flex-col gap-2.5 overflow-hidden rounded-md bg-white px-2.5 shadow-xs dark:bg-[#151518] draggable-handle",
              {
                "justify-center": !selectedChannel,
                "p-2 justify-between": selectedChannel,
              },
            )}
          >
            <div className="flex items-center gap-3 overflow-x-auto overflow-y-hidden cursor-move">
              <button
                onClick={() => setSelectedChannel(null)}
                className={clsx("whitespace-nowrap p-1.5 text-sm", {
                  "dark:bg-[#212126] dark:text-white font-medium bg-light-50 text-[#0088CC] rounded":
                    !selectedChannel,
                  "text-light-600 hover:border-light-900 hover:text-light-900 dark:text-light-400 dark:hover:text-light-200":
                    selectedChannel,
                })}
              >
                Overview
              </button>
              {NEWS_TYPES.map((newsType) => (
                <NewsMenu
                  key={newsType.label}
                  newsType={newsType}
                  selectedChannel={selectedChannel}
                  setSelectedChannel={setSelectedChannel}
                  setShowSearchDropdown={setShowSearchDropdown}
                />
              ))}
              <NewsMenuInput
                showDropdown={showSearchDropdown}
                setShowDropdown={setShowSearchDropdown}
                setSelectedChannel={setSelectedChannel}
              />
            </div>
            {selectedChannel && (
              <div className="pl-1.5 flex overflow-x-auto gap-2 overflow-y-hidden">
                {selectedChannel.main.subCategories.map((subCategory) => (
                  <Fragment key={subCategory.label}>
                    <button
                      onClick={() =>
                        setSelectedChannel({
                          main: selectedChannel.main,
                          sub: subCategory,
                        })
                      }
                      className={clsx("whitespace-nowrap pb-0.5 text-sm font-medium", {
                        "border-b border-[#0088CC] text-[#0088CC] dark:border-[#33BBFF] dark:text-[#33BBFF]":
                          selectedChannel.sub.label === subCategory.label,
                        "text-light-600 hover:border-light-900 hover:text-light-900 dark:text-light-400 dark:hover:text-light-200":
                          selectedChannel.sub.label !== subCategory.label,
                      })}
                    >
                      {subCategory.label}
                    </button>
                    {selectedChannel.main.subCategories.indexOf(subCategory) !==
                      selectedChannel.main.subCategories.length - 1 && (
                      <div className="text-light-200 dark:text-[#46464F]">|</div>
                    )}
                  </Fragment>
                ))}
              </div>
            )}
          </div>
          <div key="c">
            <RenderIfVisible>
              <BigStories
                setOpenModalTitle={setOpenModalTitle}
                channel={selectedChannel ? selectedChannel.sub.channel : null}
              />
            </RenderIfVisible>
          </div>
          <div
            key="news"
            data-grid={{
              x: 0,
              y: 12,
              w: isMobile ? 40 : 20,
              h: remainingHeight,
              isResizable: false,
            }}
          >
            <RenderIfVisible>
              {selectedChannel ? (
                <News
                  setOpenModalTitle={setOpenModalTitle}
                  showClose={false}
                  title={`Results for ${selectedChannel.sub.label}`}
                  newsChannel={selectedChannel.sub.channel}
                  showEllipsis={false}
                  aiEnabled={false}
                />
              ) : (
                <News
                  setOpenModalTitle={setOpenModalTitle}
                  showClose={false}
                  title="Global News"
                  newsChannel="Top Stories"
                  isGlobal={true}
                  showEllipsis={false}
                  aiEnabled={false}
                />
              )}
            </RenderIfVisible>
          </div>
          <div
            key="rss"
            data-grid={{
              x: isMobile ? 0 : 20,
              y: 12,
              w: isMobile ? 40 : 20,
              h: remainingHeight,
              isResizable: false,
            }}
          >
            <WidgetProvider contextOverride={rssFeedContext}>
              <RenderIfVisible>
                <RSSViewer filter={selectedChannel?.sub?.channel ?? ""} />
              </RenderIfVisible>
            </WidgetProvider>
          </div>
        </GridLayout>
      </div>
    </TabProvider>
  );
}

export function getCategoryForSubCategory(newsTypes, subCategoryLabel) {
  for (const category of newsTypes) {
    const foundSubCategory = category.subCategories.find(
      (subCategory) => subCategory.label === subCategoryLabel,
    );
    if (foundSubCategory) {
      return category;
    }
  }
  return null;
}

function NewsMenuInput({
  setSelectedChannel,
  showDropdown,
  setShowDropdown,
}: {
  setSelectedChannel: (value: selectedChannel) => void;
  showDropdown: boolean;
  setShowDropdown: (value: boolean) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(dropdownRef, () => setShowDropdown(false));
  const [inputValue, setInputValue] = useState("");
  const [filteredSubCategories, setFilteredSubCategories] = useState([]);

  useEffect(() => {
    // Filter subCategories based on inputValue
    const filteredCategories = NEWS_TYPES.reduce((acc, curr) => {
      acc.push(
        ...curr.subCategories.filter((subCategory) =>
          subCategory.label.toLowerCase().includes(inputValue.toLowerCase()),
        ),
      );
      return acc;
    }, []).filter((v, i, a) => a.findIndex((t) => t.label === v.label) === i);

    setFilteredSubCategories(filteredCategories);
  }, [inputValue]);

  const handleInputChange = useCallback(
    (v: string) => {
      setInputValue(v);
      setShowDropdown(true);
    },
    [setShowDropdown],
  );

  const handleCategorySelection = useCallback(
    (subCategory) => {
      const selectedChannel = getCategoryForSubCategory(NEWS_TYPES, subCategory.label);

      if (!selectedChannel) return;

      setSelectedChannel({
        main: selectedChannel,
        sub: subCategory,
      });

      setInputValue("");
      setShowDropdown(false);
    },
    [setSelectedChannel, setShowDropdown],
  );

  const [parentPosition, setParentPosition] = useState({
    top: 0,
    left: 0,
    height: 0,
    width: 0,
  });

  useLayoutEffect(() => {
    // This effect runs synchronously after the DOM is updated.
    if (showDropdown) {
      const node = document.getElementById("dropdown-search-news-parent");
      if (node) {
        const rect = node.getBoundingClientRect();
        setParentPosition({
          top: rect.top,
          left: rect.left,
          height: rect.height,
          width: rect.width,
        });
      }
    }
  }, [showDropdown]);

  return (
    <div className="relative flex" id="dropdown-search-news-parent">
      <Input
        size="xs"
        className="w-[200px]"
        placeholder="Search for category"
        prefix={<Icon id="search" />}
        value={inputValue}
        onChange={handleInputChange}
      />
      {showDropdown &&
        createPortal(
          <div
            ref={(r) => (dropdownRef.current = r)}
            style={{
              boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
              position: "absolute",
              top: parentPosition.top + parentPosition.height + 5,
              left: parentPosition.left,
              width: parentPosition.width,
            }}
            className="!dark:bg-red-500 z-900000 flex max-h-[600px] flex-col items-start gap-[6px] overflow-y-auto rounded bg-light-50 py-2.5 dark:bg-[#24242A]"
          >
            {filteredSubCategories.length === 0 ? (
              <p className="w-full whitespace-nowrap px-5 py-0.5 text-left text-xs font-medium text-light-900 dark:text-white">
                No categories found
              </p>
            ) : (
              filteredSubCategories.map((subCategory) => (
                <div
                  key={subCategory.label}
                  onClick={() => handleCategorySelection(subCategory)}
                  className={clsx(
                    "w-full whitespace-nowrap px-5 py-0.5 text-left text-xs font-medium text-light-900 hover:bg-[#CCDEEE] dark:text-white dark:hover:bg-[#1F2937]",
                  )}
                >
                  {subCategory.label}
                </div>
              ))
            )}
          </div>,
          document.getElementById("dropdown-portal") as HTMLElement,
        )}
    </div>
  );
}

function NewsMenu({
  newsType,
  selectedChannel,
  setSelectedChannel,
  setShowSearchDropdown,
}: {
  newsType: {
    label: string;
    channel: string;
    subCategories: {
      label: string;
      channel: string;
    }[];
  };
  selectedChannel: selectedChannel;
  setSelectedChannel: (value: selectedChannel) => void;
  setShowSearchDropdown: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [enteredSubMenu, setEnteredSubMenu] = useState(false);

  const enteredSubMenuRef = useRef(enteredSubMenu);

  useEffect(() => {
    enteredSubMenuRef.current = enteredSubMenu;
  }, [enteredSubMenu]);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger
        className={clsx("whitespace-nowrap p-1.5 text-sm rounded", {
          "dark:bg-[#212126] dark:text-white font-medium bg-light-50 text-[#0088CC]":
            selectedChannel?.main.label === newsType.label,
          "text-light-600 hover:border-light-900 hover:text-light-900 dark:text-light-400 dark:hover:text-light-200":
            selectedChannel?.main.label !== newsType.label,
        })}
        onClick={() => {
          setSelectedChannel({
            main: newsType,
            sub: newsType.subCategories[0],
          });
        }}
        onMouseEnter={() => {
          setShowSearchDropdown(false);
          setOpen(true);
        }}
        onMouseLeave={() => {
          setTimeout(() => {
            if (!enteredSubMenuRef.current) {
              setOpen(false);
            }
          }, 500);
        }}
      >
        {newsType.label}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          onMouseEnter={() => {
            setEnteredSubMenu(true);
          }}
          onMouseLeave={() => {
            setEnteredSubMenu(false);
          }}
          style={{
            boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
          }}
          className="z-60 inline-flex h-full w-full flex-col items-start justify-start gap-2 rounded bg-white p-2 shadow-sm dark:bg-[#24242A]"
          sideOffset={5}
          align="start"
        >
          {newsType.subCategories.map((subCategory) => (
            <DropdownMenu.Item
              key={subCategory.label}
              onClick={() =>
                setSelectedChannel({
                  main: newsType,
                  sub: subCategory,
                })
              }
              className={clsx(
                "cursor-pointer w-full whitespace-nowrap px-5 py-0.5 text-left text-xs font-medium text-light-900 hover:bg-[#CCDEEE] dark:text-white dark:hover:bg-[#1F2937]",
              )}
            >
              {subCategory.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const NEWS_TYPES = [
  {
    label: "Markets",
    channel: "Markets",
    subCategories: [
      {
        // this one is dumb and needs to be no "-" in the channel but After-Hours does need it
        label: "Pre-Market Outlook",
        channel: "Pre Market Outlook",
      },
      {
        label: "Treasuries",
        channel: "Treasuries",
      },
      {
        label: "After-Hours Center",
        channel: "After-Hours Center",
      },
      {
        label: "Intraday Update",
        channel: "Intraday Update",
      },
      {
        label: "Movers",
        channel: "Movers",
      },
      {
        label: "ETFs",
        channel: "ETFs",
      },
      {
        label: "Mutual Funds",
        channel: "Mutual Funds",
      },
      {
        label: "Forex",
        channel: "Forex",
      },
      {
        label: "Commodities",
        channel: "Commodities",
      },
      {
        label: "Options",
        channel: "Options",
      },
      {
        label: "Bonds",
        channel: "Bonds",
      },
      {
        label: "Futures",
        channel: "Futures",
      },
      {
        label: "CME Group",
        channel: "CME Group",
      },
      {
        label: "Cannabis",
        channel: "Cannabis",
      },
    ],
  },
  {
    label: "Economics",
    channel: "Economics",
    subCategories: [
      {
        label: "Regulations",
        channel: "Regulations",
      },
      {
        label: "Treasuries",
        channel: "Treasuries",
      },
      {
        label: "Federal Reserve",
        channel: "Federal Reserve",
      },
      {
        label: "SEC",
        channel: "SEC",
      },
    ],
  },
  {
    label: "Industries",
    channel: "Market-Moving Exclusives",
    subCategories: [
      {
        label: "Tech",
        channel: "Tech",
      },
      {
        label: "Media",
        channel: "Media",
      },
      {
        label: "Insurance",
        channel: "Insurance",
      },
      {
        label: "Education",
        channel: "Education",
      },
      {
        label: "Health Care",
        channel: "Health Care",
      },
      {
        label: "Hedge Funds",
        channel: "Hedge Funds",
      },
      {
        label: "Travel",
        channel: "Travel",
      },
      {
        label: "Real Estate",
        channel: "Real Estate",
      },
      {
        label: "REIT",
        channel: "REIT",
      },
      {
        label: "Small Business",
        channel: "Small Business",
      },
    ],
  },
  {
    label: "Events",
    channel: "News",
    subCategories: [
      {
        label: "M&A",
        channel: "M&A",
      },
      {
        label: "Earnings",
        channel: "Earnings",
      },
      {
        label: "Guidance",
        channel: "Guidance",
      },
      {
        label: "Dividends",
        channel: "Dividends",
      },
      {
        label: "Rumors",
        channel: "Rumors",
      },
      {
        label: "Financing",
        channel: "Financing",
      },
      {
        label: "Offerings",
        channel: "Offerings",
      },
      {
        label: "Contracts",
        channel: "Contracts",
      },
      {
        label: "Retail Sales",
        channel: "Retail Sales",
      },
      {
        label: "Buybacks",
        channel: "Buybacks",
      },
      {
        label: "Asset Sales",
        channel: "Asset Sales",
      },
      {
        label: "Management",
        channel: "Management",
      },
      {
        label: "Insider Trades",
        channel: "Insider Trades",
      },
      {
        label: "Stock split",
        channel: "Stock split",
      },
      {
        label: "IPOs",
        channel: "IPOs",
      },
      {
        label: "Press Releases",
        channel: "Press Releases",
      },
    ],
  },
  {
    label: "Tech",
    channel: "Tech",
    subCategories: [
      {
        label: "Cryptocurrency",
        channel: "Cryptocurrency",
      },
      {
        label: "Startups",
        channel: "Startups",
      },
      {
        label: "Entrepreneurship",
        channel: "Entrepreneurship",
      },
      {
        label: "Biotech",
        channel: "Biotech",
      },
      {
        label: "Fintech",
        channel: "Fintech",
      },
    ],
  },
  {
    label: "Politics",
    channel: "Politics",
    subCategories: [
      {
        label: "Global",
        channel: "Global",
      },
      {
        label: "Politics",
        channel: "Politics",
      },
      {
        label: "Government",
        channel: "Government",
      },
      {
        label: "FDA",
        channel: "FDA",
      },
      {
        label: "Legal",
        channel: "Legal",
      },
      {
        label: "Eurozone",
        channel: "Eurozone",
      },
      {
        label: "Emerging Markets",
        channel: "Emerging Markets",
      },
    ],
  },
  {
    label: "Ratings",
    channel: "Analyst Ratings",
    subCategories: [
      {
        label: "Analyst Color",
        channel: "Analyst Color",
      },
      {
        label: "Downgrades",
        channel: "Downgrades",
      },
      {
        label: "Upgrades",
        channel: "Upgrades",
      },
      {
        label: "Initiations",
        channel: "Initiations",
      },
      {
        label: "Price Target",
        channel: "Price Target",
      },
      {
        label: "Reiteration",
        channel: "Reiteration",
      },
      {
        label: "Termination",
        channel: "Termination",
      },
    ],
  },
  {
    label: "Opinion",
    channel: "Opinion",
    subCategories: [
      {
        label: "Signals",
        channel: "Signals",
      },
      {
        label: "Option",
        channel: "Option",
      },
      {
        label: "Exclusives",
        channel: "Exclusives",
      },
      {
        label: "Hot",
        channel: "Hot",
      },
      {
        label: "Interview",
        channel: "Interview",
      },
    ],
  },
];
