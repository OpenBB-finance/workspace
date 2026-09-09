import { cn } from "~/lib/utils";
import CopyButton from "./CopyButton";

export default function CodeSnippet({
  text,
  copyText,
  className = "",
  codeClassName = "",
  disabled = false,
  hideCopy = false,
}: {
  text: string;
  copyText?: string;
  className?: string;
  codeClassName?: string;
  disabled?: boolean;
  hideCopy?: boolean;
}) {
  return (
    <pre className={cn("relative min-h-[40px] max-h-[240px]", className)}>
      <code
        className={cn(
          "flex overflow-x-auto rounded-md border h-full items-start pl-3",
          !hideCopy && "pr-16",
          "bg-general-bg-secondary border-general-border-secondary",
          "text-ds-text-body [&_svg]:text-ds-text-caption!",
          {
            "pointer-events-none text-general-label-disabled bg-general-bg-secondary-disabled border-general-border-disabled [&_svg]:text-general-label-disabled!":
              disabled,
          },
          codeClassName,
        )}
      >
        {!hideCopy && (
          <div className="absolute right-0 pl-1 pr-3 pt-1 top-0 text-ds-text-caption">
            <CopyButton text={copyText || text} />
          </div>
        )}
        <div className="py-2 whitespace-pre">{text}</div>
      </code>
    </pre>
  );
}
