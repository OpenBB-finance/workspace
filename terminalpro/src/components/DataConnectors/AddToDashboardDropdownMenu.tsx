import { type ReactNode, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useShallowAppStore } from "~/lib/state/app";
import { generateRandomName, uuidv4 } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import { Checkbox } from "../ds/atoms/Checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "../ds/atoms/DropdownMenu";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
export default function AddToDashboardDropdownMenu({
  onAddToDashboard,
  mainButton = false,
  disabled = false,
  customTrigger,
  tooltipMessage = "Add widgets to dashboard",
  onOpenChange,
}: {
  onAddToDashboard: (dashboards: string[] | "new") => void;
  mainButton?: boolean;
  disabled?: boolean;
  customTrigger?: ReactNode;
  tooltipMessage?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const { id } = useParams();
  const [open, setOpen] = useState(false);
  const [selectedDashboards, setSelectedDashboards] = useState<string[]>(
    id ? [id] : [],
  );
  const { items, addTab } = useShallowAppStore((state) => ({
    items: state.items,
    addTab: state.addTab,
  }));

  const validDashboards = Object.values(items).filter(
    (item) => !(item.isFolder || item.isRoot),
  );

  const listRef = useRef<HTMLDivElement>(null);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        onOpenChange?.(newOpen);
      }}
    >
      <Tooltip position="top" message={tooltipMessage}>
        {customTrigger ? (
          <DropdownMenuTrigger asChild={true}>{customTrigger}</DropdownMenuTrigger>
        ) : mainButton ? (
          <DropdownMenuTrigger
            className={
              "obb-small-navbar-btn rounded flex items-center justify-center size-7"
            }
            onClick={(e) => {
              e.stopPropagation();
            }}
            disabled={disabled}
          >
            <Icon id="add-to-dashboard" className="w-[25px] h-[14px]" />
          </DropdownMenuTrigger>
        ) : (
          <DropdownMenuTrigger asChild={true}>
            <Button size="xs" variant="secondary" className="p-1">
              <Icon id="add-to-dashboard" className="size-5" />
            </Button>
          </DropdownMenuTrigger>
        )}
      </Tooltip>
      <DropdownMenuPortal>
        <DropdownMenuContent
          side="bottom"
          align="end"
          sideOffset={10}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex gap-1.5 p-1"
            onClick={() => {
              const id = uuidv4();
              addTab({
                index: id,
                data: {
                  name: generateRandomName(),
                  type: "custom",
                  widgets: [],
                },
              });
              setSelectedDashboards([...selectedDashboards, id]);
              setTimeout(() => {
                listRef.current?.scrollTo({
                  top: listRef.current?.scrollHeight,
                  behavior: "smooth",
                });
              }, 100);
            }}
          >
            <Icon id="plus" />
            Create New Dashboard
          </button>
          <div className="h-[1px] bg-light-300 dark:bg-dark-400 my-2" />
          <div className="space-y-2">
            <p
              // TODO: ds replace this with tw class, replace also the filter and category from widget menu
              className="truncate text-2xs uppercase tracking-widest text-light-500 dark:text-light-600 whitespace-nowrap"
            >
              DASHBOARDS
            </p>
            <div ref={listRef} className="space-y-2 overflow-y-auto max-h-[200px] mb-2">
              {validDashboards.map((dashboard) => (
                <Checkbox
                  onClick={(e) => e.stopPropagation()}
                  key={dashboard.index}
                  checked={selectedDashboards.includes(dashboard.index)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedDashboards([...selectedDashboards, dashboard.index]);
                    } else {
                      setSelectedDashboards(
                        selectedDashboards.filter((id) => id !== dashboard.index),
                      );
                    }
                  }}
                  label={dashboard.data.name}
                />
              ))}
            </div>
            <Button
              disabled={selectedDashboards.length === 0}
              size="xs"
              className="float-right"
              onClick={() => {
                onAddToDashboard(selectedDashboards);
                setOpen(false);
              }}
            >
              Add widgets
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
