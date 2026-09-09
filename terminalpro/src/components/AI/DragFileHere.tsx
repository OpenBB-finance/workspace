import { cn } from "~/lib/utils";
import Icon from "../Icon";

export default function DragFileHere({ className }: { className?: string }) {
  return (
    <div
      data-testid="drag-file-here"
      className={cn(
        "rounded border border-dashed bg-white dark:border-[#505059] dark:bg-[#303038] dark:text-[#6D6E74] w-full h-full flex items-center justify-center",
        className,
      )}
    >
      <div className="flex items-center justify-center flex-col gap-2.5">
        <Icon id="download-icon" className="h-4 w-4" />
        <p>Drag the file here</p>
      </div>
    </div>
  );
}
