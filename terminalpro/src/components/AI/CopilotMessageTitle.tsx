import clsx from "clsx";
import LoadingSpinnerIcon from "~/components/Icons/LoadingSpinner";
import Icon from "../Icon";

type CopilotMessageTitleProps = {
  isExpanded: boolean;
  isExpandable: boolean;
  toggleDropdown: () => void;
  content: string;
  eventType: string;
  showIcon: boolean;
  isStepByStepInProgress?: boolean;
  groupIndex?: number;
  isLastGroup?: boolean;
};

export default function CopilotMessageTitle(props: CopilotMessageTitleProps) {
  const {
    isExpanded,
    isExpandable,
    toggleDropdown,
    content,
    eventType,
    showIcon,
    isStepByStepInProgress,
    groupIndex = 0,
    isLastGroup = false,
  } = props;

  // Downgrade WARNING/ERROR to INFO when the agent recovered (continued past this group)
  const displayEventType =
    !isLastGroup && (eventType === "WARNING" || eventType === "ERROR")
      ? "INFO"
      : eventType;

  // Calculate animation delay based on group index to create continuous flow
  const animationDelay = -(groupIndex * 0.4);

  return (
    <div
      onClick={isExpandable ? toggleDropdown : null}
      className={clsx(
        "_message-title relative flex flex-row items-center py-1 rounded group min-w-10 transition-all duration-400 ease-linear bg-light-50 dark:bg-dark-850",
        {
          "cursor-pointer": isExpandable,
        },
      )}
    >
      <div className="flex flex-row items-center dark:group-hover:text-light-200 group-hover:text-light-600 w-full">
        {showIcon && (
          <div className="pl-2">
            {displayEventType === "INFO" &&
              (isStepByStepInProgress ? (
                <LoadingSpinnerIcon
                  className={clsx("size-3 mr-2 animate-spin", {
                    "fill-light-600 dark:fill-light-200": isExpanded,
                    "fill-light-500 dark:fill-light-500": !isExpanded,
                  })}
                />
              ) : (
                <Icon
                  id="info-outline-circle"
                  className={clsx("size-3 mr-2", {
                    "dark:text-brand-lighter text-brand-main": isExpanded,
                    "dark:group-hover:text-brand-lighter dark:text-brand-main group-hover:text-brand-main text-brand-lighter":
                      !isExpanded,
                  })}
                />
              ))}
            {displayEventType === "WARNING" && (
              <Icon
                id="exclamation-outline-triangle"
                className={clsx("size-3 mr-2", {
                  "dark:text-orange-400 text-orange-600": isExpanded,
                  "dark:group-hover:text-orange-400 dark:text-orange-600 group-hover:text-orange-600 text-orange-400":
                    !isExpanded,
                })}
              />
            )}
            {displayEventType === "ERROR" && (
              <Icon
                id="x-outline-circle"
                className={clsx("size-3 mr-2", {
                  "dark:text-red-400 text-red-600": isExpanded,
                  "dark:group-hover:text-red-400 dark:text-red-600 group-hover:text-red-600 text-red-400":
                    !isExpanded,
                })}
              />
            )}
          </div>
        )}
        <p
          style={{ animationDelay: `${animationDelay}s` }}
          className={clsx(
            "ml-3 prose-sm prose-p:my-1.5 overflow-x-auto text-xs font-medium",
            {
              "step-by-step-gradient": isStepByStepInProgress,
              "dark:text-light-200 text-light-600":
                isExpanded && !isStepByStepInProgress,
              "dark:group-hover:text-light-200 group-hover:text-light-600 dark:text-light-500 text-light-500":
                !(isExpanded || isStepByStepInProgress),
            },
          )}
        >
          {content}
        </p>
      </div>
      {isExpandable && (
        <Icon
          id={isExpanded ? "chevron-down" : "chevron-right"}
          className={clsx("size-3 ml-1 mr-2", {
            "dark:text-light-200 text-light-600": isExpanded,
            "dark:group-hover:text-light-200 group-hover:text-light-600 dark:text-light-500 text-light-500":
              !isExpanded,
          })}
        />
      )}
    </div>
  );
}
