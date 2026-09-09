import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTemplatePrompts } from "~/hooks/useTemplatePrompts";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { useCopilotContext } from "~/lib/contexts/CopilotChatContext";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { cn } from "~/lib/utils";
import Avatar from "../General/Avatar";
import Icon from "../Icon";
import { useShallowStreamingStore } from "./hooks/useStreaming";
import { dispatchCopilotCommand } from "./hooks/utils";
import TextStyle from "./TextStyle";

const aiCopilotDocumentationLinksFF = getConfig().copilot.documentationLinks;

export function CopilotWelcome() {
  const { id: currentDashboardId } = useParams();
  const handleSubmitRef = useCopilotContext()?.handleSubmitRef;

  const { limitReached, isDragging } = useShallowStreamingStore((state) => ({
    limitReached: state.limitReached,
    isDragging: state.isDragging,
  }));

  const { selectedCopilot, showWelcome, copilotTextSuggestions } =
    useShallowCopilotStore((s) => ({
      selectedCopilot: s.selectedCopilot,
      showWelcome: s.showWelcome,
      copilotTextSuggestions: s.copilotTextSuggestions,
    }));

  const templateId = useShallowAppStore(
    (s) => s?.getSideBarItem(currentDashboardId)?.data?.templateId,
  );

  const templatePrompts = useTemplatePrompts(templateId ?? "");
  const { hasTemplatePrompts, promptsToShow } = useMemo(() => {
    const hasOwnTemplatePrompts = templatePrompts.length > 0;
    const hasBuiltInSuggestions = copilotTextSuggestions.length > 0;

    return {
      hasTemplatePrompts: hasOwnTemplatePrompts || hasBuiltInSuggestions,
      promptsToShow: hasOwnTemplatePrompts
        ? templatePrompts.slice(0, 3)
        : copilotTextSuggestions.slice(0, 3).map(({ question }) => question),
    };
  }, [templatePrompts, copilotTextSuggestions]);

  const [expandedMainPrompts, setExpandedMainPrompts] = useState<Set<number>>(
    new Set(),
  );
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<number>>(
    new Set(),
  );

  const toggleMainPrompt = (index: number) => {
    setExpandedMainPrompts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSuggestion = (index: number) => {
    setExpandedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (!showWelcome || limitReached || isDragging) return null;

  return (
    <div className="flex flex-col items-center text-center w-full h-full overflow-y-auto py-6 max-md:py-3">
      <div className="min-w-0 max-md:w-full md:min-w-[306px] md:max-w-[50%] lg:max-w-[70%] xl:max-w-[75%] flex-shrink-0 px-6 max-md:px-3 my-auto">
        <div className="flex justify-center">
          {selectedCopilot?.id === "openbb-copilot" ? (
            <div
              className={cn(
                "h-8 w-8",
                "bg-brand-main",
                "flex items-center justify-center",
                "rounded shadow-sm",
              )}
            >
              <Icon id="sparkles-icon" className="h-[14px] w-[14px] text-white" />
            </div>
          ) : (
            <Avatar
              className="w-16 h-16 rounded"
              variant="noVariant"
              src={selectedCopilot?.image}
              alt={selectedCopilot?.name}
              fallback={
                <div className="w-8 h-8 bg-general-bg-secondary rounded flex items-center justify-center">
                  <Icon id="user-icon" className="h-5 w-5 text-ds-text-body" />
                </div>
              }
            />
          )}
        </div>
        <p className="mb-5 mt-3 text-sm font-bold text-ds-text-heading">
          {selectedCopilot?.name}
        </p>

        {hasTemplatePrompts ? (
          <div>
            <p className="mb-3 text-xs text-ds-text-body text-center">
              Get started with these suggested prompts for this dashboard:
            </p>
            <div className="flex flex-col gap-1.5 w-full">
              {promptsToShow.map((prompt, index) => {
                const isExpanded = expandedMainPrompts.has(index);
                const shouldTruncate = prompt.length > 200;

                return (
                  <div
                    key={`${prompt}-${index}`}
                    className="group rounded bg-general-bg-secondary
                          hover:bg-general-bg-secondary-hover transition-colors"
                  >
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs
                            text-ds-text-body group-hover:text-ds-text-heading
                            transition-colors"
                      onClick={() =>
                        handleSubmitRef.current?.({
                          question: prompt,
                          addHumanMessage: true,
                        })
                      }
                    >
                      <div
                        className={cn({
                          "line-clamp-4 max-md:line-clamp-2":
                            !isExpanded && shouldTruncate,
                        })}
                      >
                        <TextStyle content={prompt} />
                      </div>
                    </button>
                    {shouldTruncate && (
                      <button
                        type="button"
                        className="px-3 pb-2 text-2xs font-medium
                              text-link-color hover:underline"
                        onClick={() => toggleMainPrompt(index)}
                      >
                        {isExpanded ? "Read less" : "Read more"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-col gap-5 w-full">
              <div className="w-full">
                <div className="body-xs-semibold uppercase tracking-wider text-ds-text-caption mb-2 text-left text-2xs">
                  Widgets
                </div>
                <div className="bg-general-bg-secondary rounded p-3 body-xs-regular text-ds-text-body text-start">
                  Click{" "}
                  <Icon
                    id="message-plus"
                    className="inline-block w-4 h-4 align-middle"
                  />{" "}
                  on a widget to add it as explicit context.
                </div>
              </div>

              <div className="w-full">
                <div className="body-xs-semibold uppercase tracking-wider text-ds-text-caption mb-2 text-left text-2xs">
                  Chat Input Area
                </div>
                <div className="flex flex-col gap-2.5 w-full">
                  <div className="bg-general-bg-secondary rounded p-3 body-xs-regular text-ds-text-body text-start">
                    Use the <strong>@</strong> button to select widgets directly from
                    the AI panel, or simply type <strong>@widget_name</strong>.
                  </div>
                  <div className="bg-general-bg-secondary rounded p-3 body-xs-regular text-ds-text-body text-start">
                    Type <strong>/</strong> to browse and run available skills and MCP
                    servers.
                  </div>
                </div>
              </div>

              {!inSnowflakeNativeApp && (
                <div className="w-full">
                  <div className="body-xs-semibold uppercase tracking-wider text-ds-text-caption mb-2 text-left text-2xs">
                    Chat Settings
                  </div>
                  <div className="flex flex-col gap-2.5 w-full">
                    <div className="bg-general-bg-secondary rounded p-3 body-xs-regular text-ds-text-body text-start">
                      Activate Global data{" "}
                      <Icon
                        id="layout-top"
                        className="inline-block w-4 h-4 align-middle"
                      />{" "}
                      to retrieve data from any widget available in the library.
                    </div>
                    <div className="bg-general-bg-secondary rounded p-3 body-xs-regular text-ds-text-body text-start">
                      Activate Generative UI{" "}
                      <Icon
                        id="zap-icon"
                        className="inline-block w-4 h-4 align-middle"
                      />{" "}
                      that grants control of the dashboard by adding and modifying
                      widgets.
                    </div>
                  </div>
                </div>
              )}

              {aiCopilotDocumentationLinksFF && (
                <p className="body-xs-regular text-ds-text-caption text-left">
                  For more information, see our{" "}
                  <a
                    className="text-link-color underline underline-offset-2"
                    href="https://docs.openbb.co/workspace/analysts/ai-features/copilot-basics"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Copilot Documentation
                  </a>
                  .
                </p>
              )}
            </div>
            {copilotTextSuggestions.length > 0 && (
              <div
                className={cn(
                  "flex flex-col gap-1.5 mt-6 w-full max-h-[150px]",
                  copilotTextSuggestions.length > 2 && "overflow-y-auto",
                )}
              >
                {copilotTextSuggestions.slice(0, 3).map(({ question }, index) => {
                  const isExpanded = expandedSuggestions.has(index);
                  const shouldTruncate = question.length > 100;

                  return (
                    <div
                      key={`${question}-${index}`}
                      className="group rounded bg-general-bg-secondary
                            hover:bg-general-bg-secondary-hover transition-colors"
                    >
                      <button
                        type="button"
                        className="flex gap-2 items-start w-full text-left
                              px-3 py-2 text-xs text-ds-text-body
                              group-hover:text-ds-text-heading transition-colors"
                        onClick={() => {
                          dispatchCopilotCommand(question);
                          setTimeout(() => {
                            document.getElementById("copilot-input")?.focus();
                          }, 100);
                        }}
                      >
                        <Icon
                          id="lightbulb-03"
                          className="h-4 w-4 text-ds-text-caption shrink-0 mt-px"
                        />
                        <div
                          className={cn({
                            "line-clamp-2": !isExpanded && shouldTruncate,
                          })}
                        >
                          <TextStyle content={question} />
                        </div>
                      </button>
                      {shouldTruncate && (
                        <button
                          type="button"
                          className="ml-9 pb-2 text-2xs font-medium
                                text-link-color hover:underline"
                          onClick={() => toggleSuggestion(index)}
                        >
                          {isExpanded ? "Read less" : "Read more"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CopilotWelcomeRoot() {
  return useMemo(() => <CopilotWelcome />, []);
}
