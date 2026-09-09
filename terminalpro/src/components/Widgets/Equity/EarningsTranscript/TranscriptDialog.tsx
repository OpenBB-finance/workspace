import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import { useCopilotDataStore } from "~/lib/state/copilotData";
import { generateRandomName } from "~/lib/utils";
import Dialog from "../../Helpers/Dialog";
import type { SingleTranscriptProps } from "./hooks";

const EarningsTranscriptContent = lazy(() =>
  import("./EarningsTranscript").then((module) => ({
    default: module.EarningsTranscriptContent,
  })),
);

export function EarningsAddAsWidget(
  props: SingleTranscriptProps & { setDialog: (val: boolean) => void },
) {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const lastInnerTab = useShallowAppStore((state) => state?.getLastInnerTab(id));
  const innerTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab || "",
    [lastInnerTab, searchParams.get("tab")],
  );

  const { getAllTabs, addWidget, addTab } = useAppStore();

  const { transcriptData, mainTicker, setDialog } = props;

  const widget = {
    id: uuidv4(),
    name: "Earnings Transcripts",
    description: "Full transcripts of earnings call",
    widgetId: "earnings_transcripts",
    type: "custom",
    gridData: {
      w: 40,
      h: 12,
    },
    data: { mainTicker: mainTicker },
    storage: {
      params: {
        year: transcriptData?.year,
        quarter: `Q${transcriptData?.quarter}`,
      },
    },
  } as any;

  const tabs = getAllTabs()?.sort((a, _b) => (a.index === id ? -1 : 1));
  const navigate = useNavigate();
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger tabIndex={-1}>
        <Icon id="copy-to-file" className="w-5 h-5" />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={10}
          className="obb-dropdown-container w-fit z-60 shadow-[var(--dropdown-shadow)]"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <p className="obb-uppercase-small-title">Open as a Widget on the Dashboard</p>
          {tabs.map((tab) => (
            <DropdownMenuPrimitive.Item
              key={tab.index}
              className={"obb-dropdown-item flex justify-between"}
              onSelect={() => {
                addWidget(tab.index, { ...widget, innerTab });
                const isCurrentTab = id === tab.index;

                /*const confirmation = {
                  confirmLabel: "Navigate to Dashboard",
                  cancelLabel: "Close",
                  onCancel: () => {},
                  onConfirm: () => {
                    navigate(`/app/${tab.index}`);
                  },
                };*/

                toast.success("Widget added to dashboard");

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
              }}
            >
              {tab.data.name}
              {id === tab.index && (
                <span className="rounded-[12px] bg-general-bg-secondary px-1.5 text-2xs text-ds-text-caption">
                  Current
                </span>
              )}
            </DropdownMenuPrimitive.Item>
          ))}
          {tabs.length !== 0 && (
            <DropdownMenuPrimitive.Separator className="h-px bg-surface-divider" />
          )}
          <DropdownMenuPrimitive.Item
            className={"obb-dropdown-item"}
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
              setDialog(false);
              toast.success("New dashboard created");
            }}
          >
            New Dashboard
          </DropdownMenuPrimitive.Item>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

export function EarningsTranscriptDialog(props: SingleTranscriptProps) {
  const [dialog, setDialog] = useState(false);

  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const lastInnerTab = useShallowAppStore((state) => state?.getLastInnerTab(id));
  const innerTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab || "",
    [lastInnerTab, searchParams.get("tab")],
  );

  return (
    props?.transcriptData && (
      <Dialog
        open={dialog}
        setOpen={setDialog}
        extraDialogClass="2xl:max-w-[1200px] ignore-select-widget"
        trigger={
          <div
            className="text-link-color ignore-select-widget"
            onClick={() => setDialog(true)}
          >
            View transcript
          </div>
        }
        title={`${props.earnings_date} Earnings Transcript`}
        otherNavElements={
          <>
            <EarningsAddAsWidget
              mainTicker={props.mainTicker}
              transcriptData={props.transcriptData}
              setDialog={setDialog}
            />
            <Tooltip message="Open as Widget and select it as context for Copilot">
              <button
                tabIndex={-1}
                className="w-5 h-5"
                onClick={() => {
                  const widget = {
                    id: uuidv4(),
                    name: "Earnings Transcripts",
                    description: "Full transcripts of earnings call",
                    widgetId: "earnings_transcripts",
                    type: "custom",
                    gridData: {
                      w: 40,
                      h: 12,
                    },
                    data: { mainTicker: props.mainTicker },
                    storage: {
                      params: {
                        year: props.transcriptData?.year,
                        quarter: `Q${props.transcriptData?.quarter}`,
                      },
                    },
                  } as any;
                  useAppStore.getState().addWidget(id, { ...widget, innerTab });
                  useCopilotDataStore.getState().toggleSelectedWidget(widget.id);
                  setDialog(false);
                }}
              >
                <Icon id="message-square-plus" />
              </button>
            </Tooltip>
          </>
        }
        children={
          <Suspense fallback={null}>
            <EarningsTranscriptContent
              transcriptData={props.transcriptData}
              globalFilter={""}
            />
          </Suspense>
        }
      />
    )
  );
}
