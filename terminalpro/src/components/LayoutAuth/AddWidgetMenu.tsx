import { useParams } from "react-router-dom";
import Icon from "~/components/Icon";
import { useShallowAppStore } from "~/lib/state/app";
import { useSharedAppStore } from "~/lib/state/sharedApp";
import { useThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import { useDataConnectorContext } from "../DataConnectors/Providers/DataConnectorContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "../ds/atoms/DropdownMenu";
import Tooltip from "../Tooltip";

export default function AddWidgetMenu() {
  const { setOpen } = useDataConnectorContext();
  const { toggleSearch, quickAddButtonVisible, setInitialSelectedSearchTab } =
    useThemeStore();

  const { id } = useParams();

  const { sharedItems } = useSharedAppStore();

  const isShared = useShallowAppStore((state) => state.isDashboardShared(id));

  const notOwner = !!sharedItems?.[id];

  const handleClickWidget = () => {
    setInitialSelectedSearchTab("widgets");
    toggleSearch();
  };

  const handleClickData = () => {
    setOpen(true);
  };

  if (isShared && notOwner) {
    return (
      <Tooltip
        message={
          <p className="body-xs-regular max-w-md break-words whitespace-normal">
            <strong>{"This dashboard is shared — "}</strong>
            You're allowed to change tickers and switch tabs. You don’t have permission
            to add, remove or resize widgets. Duplicate the template first before
            applying any modifications.
          </p>
        }
      >
        <button
          disabled={true}
          className={cn(
            "_add-widget-button",
            "absolute bottom-6 right-6 z-30",
            "bg-brand-darker",
            "flex items-center justify-center",
            "rounded shadow-sm",
            "w-10 h-10",
            "transition-opacity",
            "focus:outline-hidden",
          )}
        >
          <Icon id="locker" className="h-[17px] w-[17px] text-light-500" />
        </button>
      </Tooltip>
    );
  }

  return (
    quickAddButtonVisible && (
      <DropdownMenu>
        <Tooltip message="Add data">
          <DropdownMenuTrigger asChild={true}>
            <button
              className={cn(
                "_add-widget-button",
                "absolute bottom-6 right-[28px] z-30",
                "bg-brand-main hover:bg-brand-darker",
                "flex items-center justify-center",
                "rounded shadow-sm",
                "w-10 h-10",
                "transition-opacity",
                "focus:outline-hidden",
              )}
              //onClick={handleClick}
            >
              <Icon id="plus-icon" className="h-[17px] w-[17px] text-white" />
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuPortal>
          <DropdownMenuContent
            side="top"
            align="end"
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="space-y-2"
          >
            <DropdownMenuItem
              className="obb-dropdown-item"
              onSelect={handleClickWidget}
            >
              Add widget
            </DropdownMenuItem>
            <DropdownMenuItem className="obb-dropdown-item" onSelect={handleClickData}>
              Add data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    )
  );
}
