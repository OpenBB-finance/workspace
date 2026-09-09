import * as Popover from "@radix-ui/react-popover";
import { twMerge } from "tailwind-merge";
import CopyIcon from "./Icons/Copy";

interface Props {
  text: string;
  className?: string;
  copyClassName?: string;
}

export default function CopyButton({ text, className, copyClassName }: Props) {
  return (
    <Popover.Root>
      <Popover.Anchor>
        <Popover.Trigger
          type="button"
          onClick={() => navigator.clipboard.writeText(text)}
          className={twMerge(
            "_link-icon backdrop-blur-xs text-light-500 dark:text-light-400",
            className,
          )}
        >
          <CopyIcon className={twMerge("h-4 w-4", copyClassName)} />
        </Popover.Trigger>
      </Popover.Anchor>

      <Popover.Content
        side="top"
        sideOffset={5}
        className="rounded border border-light-600 dark:bg-[#303038] bg-light-200 dark:text-light-200 p-2 py-1 uppercase will-change-[transform,opacity] data-[state=open]:data-[side=top]:animate-slide-down-fade"
      >
        Copied
      </Popover.Content>
    </Popover.Root>
  );
}
