import Icon from "~/components/Icon";
import { useDataConnectorStore } from "~/lib/state/dataConnector";
import { cn } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import type { IconId } from "../Icon.types";

export function NativeConnector({
  name,
  icon,
  handleClick,
}: {
  name: string;
  icon: IconId;
  handleClick?: () => void;
}) {
  const { dataConnectorUrl } = useDataConnectorStore();
  const disabled = !handleClick || null;
  return (
    <div className="group flex min-w-[105px] flex-col items-center gap-2.5">
      <div
        className={cn(
          "flex h-[105px] w-full flex-col items-center justify-center gap-2 rounded py-4",
          "bg-white text-light-600 group-data-disabled:text-light-300 group-data-disabled:bg-light-100",
          "dark:bg-dark-600 dark:text-light-300 dark:group-data-disabled:bg-dark-750 dark:group-data-disabled:text-dark-400",
        )}
      >
        <Icon id={icon} className="m-auto h-6 w-6 stroke-2" />
        <p className="mt-1 text-xs">{name}</p>
      </div>
      <Button
        variant="outlined"
        size="xs"
        disabled={disabled}
        className="w-full"
        onClick={handleClick}
      >
        {dataConnectorUrl ? "Add" : "Enable"}
      </Button>
    </div>
  );
}
