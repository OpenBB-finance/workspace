import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";
import Tooltip from "~/components/Tooltip";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { generateRandomName } from "~/lib/utils";

type NewsDropdownActionProps = {
  mainTicker: any;
  singleNews: any;
  textHtml: string;
  setDialog: (value: boolean) => void;
  openCopilot?: boolean;
  tooltipTriggerMessage?: string;
  triggerIconId?: IconId;
  handleDialogClose: () => void;
};

export default function NewsDropdownAction(props: NewsDropdownActionProps) {
  const {
    mainTicker,
    singleNews,
    textHtml,
    setDialog,
    openCopilot = false,
    triggerIconId = "copy-to-file",
    tooltipTriggerMessage = "Open as a Widget on the Dashboard",
    handleDialogClose,
  } = props;

  const { toggleSelectedWidget } = useShallowCopilotDataStore((state) => ({
    toggleSelectedWidget: state.toggleSelectedWidget,
  }));

  const { getRootTabs, addWidget, addTab } = useAppStore();

  const { id } = useParams();

  const [searchParams, _] = useSearchParams();
  const navigate = useNavigate();
  const lastInnerTab = useShallowAppStore((state) => state?.getLastInnerTab(id));
  const innerTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab || "",
    [lastInnerTab, searchParams.get("tab")],
  );

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

  const tabs = getRootTabs();

  return (
    <DropdownMenuPrimitive.Root>
      <Tooltip message={tooltipTriggerMessage}>
        <DropdownMenuPrimitive.Trigger tabIndex={-1}>
          <Icon id={triggerIconId} className="w-5 h-5" />
        </DropdownMenuPrimitive.Trigger>
      </Tooltip>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          onCloseAutoFocus={(e) => e.preventDefault()}
          align="end"
          sideOffset={10}
          className={clsx("obb-dropdown-container", "w-fit z-60")}
          style={{
            boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
          }}
        >
          <p className="obb-uppercase-small-title">Open as a Widget on the Dashboard</p>
          {tabs.map((tab) => (
            <DropdownMenuPrimitive.Item
              key={tab.index}
              className={"obb-dropdown-item flex justify-between"}
              onSelect={() => {
                addWidget(tab.index, { ...widget, innerTab });
                handleDialogClose();
                if (openCopilot) {
                  navigate(`/app/${tab.index}`);
                  setTimeout(() => {
                    toggleSelectedWidget(widget.id);
                  }, 500);
                } else {
                  const isCurrentTab = id === tab.index;

                  const _confirmation = {
                    confirmLabel: "Navigate to Dashboard",
                    cancelLabel: "Close",
                    onCancel: () => {},
                    onConfirm: () => {
                      navigate(`/app/${tab.index}`);
                    },
                  };

                  toast.success("Widget added to dashboard", {
                    description: `Widget "${widget.name}" added to ${
                      isCurrentTab ? "current" : ` "${tab.data.name}"`
                    } dashboard`,
                    //confirmation: isCurrentTab ? undefined : confirmation,
                  });

                  if (isCurrentTab) {
                    setTimeout(() => {
                      const element = document.getElementById(widget.id);
                      if (element) {
                        element.scrollIntoView({
                          behavior: "smooth",
                        });
                      }
                    }, 200);

                    setDialog(false);
                  }
                }
              }}
            >
              <span>
                {tab.data.name}
                {id === tab.index && (
                  <span className="rounded-[12px] bg-light-300 px-1.5 text-2xs text-light-600 dark:bg-[#5A59614D] dark:text-light-400">
                    Current
                  </span>
                )}
              </span>
            </DropdownMenuPrimitive.Item>
          ))}
          {tabs.length !== 0 && (
            <DropdownMenuPrimitive.Separator className="h-px bg-light-300 dark:bg-dark-500" />
          )}
          <DropdownMenuPrimitive.Item
            className={"obb-dropdown-item flex justify-between"}
            onSelect={() => {
              const id = uuidv4();
              const name = generateRandomName();
              addTab({
                index: id,
                data: {
                  name,
                  type: "custom",
                  widgets: [{ ...widget, innerTab }],
                },
              });
              navigate(`/app/${id}`);
              if (openCopilot) {
                setTimeout(() => {
                  toggleSelectedWidget(widget.id);
                }, 500);
              } else {
                setDialog(false);
                toast.success("Widget added to dashboard", {
                  description: `Widget "${widget.name}" added to "${name}" dashboard`,
                });
              }
            }}
          >
            <span>New Dashboard</span>
          </DropdownMenuPrimitive.Item>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
