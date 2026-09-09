import { Fragment, type ReactNode } from "react";
import { cn } from "../ds/utils";
import Icon from "../Icon";
import { useWidgetContext } from "../Widget.context";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderLinkedText(text: string) {
  const parts = text.split(URL_REGEX);

  return parts.map((part, index) => {
    if (!part) return null;
    if (!part.startsWith("http://") && !part.startsWith("https://")) {
      return <Fragment key={index}>{part}</Fragment>;
    }

    return (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-link-color underline underline-offset-2 hover:opacity-80"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    );
  });
}

export default function SearchResultsNotFound({
  extraClassName = "",
  children = null,
  iconClassName = "",
  firstMessage = "No results found",
  firstMessageExtraClassName = "",
  secondMessage = "We couldn't find a match for your search. Please try searching for something else.",
  icon = false,
}: {
  extraClassName?: string;
  children?: ReactNode;
  firstMessage?: string | ReactNode;
  iconClassName?: string;
  firstMessageExtraClassName?: string;
  secondMessage?: string | ReactNode;
  icon?: boolean;
}) {
  const widgetUUID = useWidgetContext(true)?.widgetRef?.current?.id;
  const renderedFirstMessage =
    typeof firstMessage === "string" ? renderLinkedText(firstMessage) : firstMessage;

  return (
    <div
      id="results-not-found"
      data-testid="results-not-found"
      className={cn(
        "h-full max-h-full min-h-0 w-full min-w-0 overflow-auto overscroll-contain text-center p-4 [container-type:size]",
        extraClassName,
      )}
    >
      <div className="flex min-h-full w-full min-w-0 flex-col items-center justify-center">
        {icon && (
          <Icon
            id="warning-icon"
            data-testid="warning-icon"
            className={cn(
              "mb-2 h-6 min-h-0 w-6 shrink text-ds-text-caption [@container(max-height:7rem)]:hidden",
              iconClassName,
            )}
          />
        )}
        {firstMessage && (
          <div
            className={cn(
              "w-full max-w-full min-w-0 px-2 text-sm font-bold text-ds-text-body",
              firstMessageExtraClassName,
            )}
          >
            <p
              id={`widget-error-${widgetUUID}`}
              className="m-0 max-w-full whitespace-pre-wrap wrap-anywhere"
            >
              {renderedFirstMessage}
            </p>
          </div>
        )}
        {secondMessage && (
          <p className="mt-0.5 w-full max-w-full min-w-0 whitespace-pre-wrap wrap-anywhere px-2 text-xs text-ds-text-caption">
            {secondMessage}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
