import Markdown, { type MarkdownToJSX, RuleType } from "markdown-to-jsx";
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useMemo,
} from "react";
import { toast } from "sonner";
import { useLocalStorage } from "usehooks-ts";
import {
  type AIMessage,
  type ArtifactT,
  type Citation as CitationT,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import { cn } from "../ds/utils";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import Citation from "./Citation";
import { CopilotFeedback } from "./CopilotFeedback";
import { useShallowStreamingStore } from "./hooks/useStreaming";
import { dispatchCreate } from "./hooks/utils";
import {
  isSafeMarkdownImageSrc,
  MarkdownAIMessageOverrides,
  renderRule,
} from "./MarkdownOverrides";
import { getEnhancedDatetimePositionStrategy } from "./utils/datetimePositioning";
import { escapeMarkdownUnderscores } from "./utils/markdown";

type CopilotAIMessageProps = {
  message: AIMessage;
  isLastGroup: boolean;
  allGroups?: any[];
  groupIndex?: number;
};

function useMessageContent(message: AIMessage, isLastGroup: boolean) {
  const isStreaming = useShallowStreamingStore(
    (s) => s.streamingStatus === "streaming-started",
  );

  // this makes sure only the last group has this active,
  // avoiding multiple re-renders of the component when streaming
  const localKeyStream = isLastGroup && isStreaming ? "streamedData" : "_empty";
  const localKeyCitations = isLastGroup && isStreaming ? "streamedCitations" : "_empty";

  const [streamedData] = useLocalStorage(localKeyStream, "");
  const [streamedCitations] = useLocalStorage<CitationT[]>(localKeyCitations, []);

  const getCurrentChatArtifact = useShallowCopilotStore(
    (state) => state.getCurrentChatArtifact,
  );

  const messageText = isLastGroup && isStreaming ? streamedData : message.content;
  const messageCitations =
    isLastGroup && isStreaming ? streamedCitations : message.citations;

  return useMemo(() => {
    const messageContent = preprocessText(messageText);
    const visibleText = getVisibleText(messageContent, getCurrentChatArtifact);
    return { messageContent, visibleText, messageCitations };
  }, [messageText, getCurrentChatArtifact, messageCitations]);
}

export default function CopilotAIMessage(props: CopilotAIMessageProps) {
  const { message, isLastGroup, allGroups, groupIndex } = props;

  const { showDatetime, hideDatetime } = useShallowCopilotStore((state) => ({
    showDatetime: state.showDatetime,
    hideDatetime: state.hideDatetime,
  }));

  const { messageContent, visibleText, messageCitations } = useMessageContent(
    message,
    isLastGroup,
  );

  const markdownOptions = useMemo<MarkdownToJSX.Options>(() => {
    const renderCitation = (citationId: string, key: string) => {
      const normalizedCitationId = citationId.replace(/\\_/g, "_");
      const { citation, index } = messageCitations.reduce(
        (acc, citation, index) => {
          if (citation.id === normalizedCitationId) {
            Object.assign(acc, { citation, index });
          }
          return acc;
        },
        { citation: null, index: -1 },
      );

      if (!citation) {
        console.warn(`Citation with id ${normalizedCitationId} not found`);
        return null;
      }
      return <Citation key={key} index={index} content={citation} />;
    };

    return {
      disableParsingRawHTML: true,
      renderRule: (next, node, renderChildren, state) => {
        if (node.type === RuleType.text) {
          const ignoreRegex = /<citation>([^<]+)<\/citation>/g;
          if (ignoreRegex.test(node.text)) {
            console.warn("Citation component missing className prop");
            return null;
          }
          const content = renderTrustedCopilotMarkers(node.text, (marker, index) => {
            const key = `${state.key}-trusted-marker-${index}`;
            if (marker.type === "artifact") {
              const ArtifactMarker = MarkdownAIMessageOverrides.artifact.component;
              return <ArtifactMarker key={key} className={marker.id} />;
            }
            return renderCitation(marker.id, key);
          });

          if (content) return content;
        }

        return renderRule(next, node, renderChildren, state);
      },
      overrides: MarkdownAIMessageOverrides,
    };
  }, [messageCitations]);

  const markDownMemo = useMemo(() => {
    return <Markdown options={markdownOptions}>{messageContent}</Markdown>;
  }, [messageContent, markdownOptions]);

  const handleMouseEnter = useCallback(() => {
    if (!allGroups || typeof groupIndex !== "number") return;

    // Use the datetime positioning strategy to determine what to show
    const strategy = getEnhancedDatetimePositionStrategy(
      message,
      allGroups,
      groupIndex,
    );

    if (strategy.shouldShowDatetime) {
      showDatetime(strategy.timestamp, strategy.targetGroupId);
    }
  }, [message, allGroups, groupIndex, showDatetime]);

  const handleMouseLeave = useCallback(
    (e: ReactMouseEvent) => {
      // check if the mouse left the message content area
      const target = e.currentTarget as HTMLElement;
      if (!target.closest("._message-title")) return hideDatetime();
    },
    [hideDatetime],
  );

  return (
    <div
      className="relative group w-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="w-full relative bg-general-bg-primary">
        {messageContent && (
          <div
            className="prose-sm text-xs! prose-p:my-1.5 pb-1 prose-pre:my-2.5
            prose dark:prose-invert max-w-none overflow-x-auto
            prose-code:break-words prose-code:whitespace-pre-wrap"
          >
            {markDownMemo}
          </div>
        )}
        {message.isCancelled && (
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-1",
              "bg-orange-50 dark:bg-orange-900/20 border",
              "border-orange-200 dark:border-orange-800 rounded",
              "text-xs text-orange-700 dark:text-orange-300",
              messageContent ? "mt-2!" : "",
            )}
          >
            <Icon id="exclamation-outline-triangle" className="h-3 w-3" />
            <span>Request cancelled before completion</span>
          </div>
        )}
      </div>
      {(!message.isCancelled || (message.isCancelled && messageContent)) && (
        <div className="inline-block">
          <div className="obb-divider my-1 mx-1.25" />
          <div className="flex items-center">
            <Tooltip message="Copy message text">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(visibleText);
                  toast.success("Text copied to clipboard");
                }}
              >
                <div className="p-1.25">
                  <Icon
                    id="clipboard-icon"
                    className="hover:opacity-80 h-3.5 w-3.5 text-light-600 dark:text-light-300"
                  />
                </div>
              </button>
            </Tooltip>
            <Tooltip message="Create widget from text">
              <button
                onClick={() => {
                  dispatchCreate({ widgetType: "text", content: visibleText });
                }}
                className=""
              >
                <div className="p-1.25">
                  <Icon
                    id="solar-widget-add-outline"
                    className="hover:opacity-80 h-3.5 w-3.5 text-light-600 dark:text-light-300"
                  />
                </div>
              </button>
            </Tooltip>
            <CopilotFeedback message={message} />
          </div>
        </div>
      )}
    </div>
  );
}

function preprocessText(text: string) {
  if (!text) return "";
  text = replaceRawImageTags(text);

  // Replace <latex>...</latex> with fenced code block for latex
  text = text.replace(/<latex>([\s\S]*?)<\/latex>/g, (_match, equation) => {
    return `\n\`\`\`latex\n${equation}\n\`\`\`\n`;
  });

  // Escape plain-text underscores to prevent markdown italics rendering, while
  // preserving URLs and code exactly as returned.
  return escapeMarkdownUnderscores(text);
}

function extractIds(text: string, tag: string) {
  const pattern = new RegExp(`<${tag}[^>]*className="([^"]*)"[^>]*>`, "g");
  const matches = [...text.matchAll(pattern)];
  return matches.map((match) => match[1]);
}

function getVisibleText(
  text: string,
  getArtifact: (id: string) => ArtifactT | undefined,
) {
  try {
    const artifactIdsInContent = extractIds(text, "artifact");
    if (artifactIdsInContent) {
      for (const artifactId of artifactIdsInContent) {
        const chatArtifact = getArtifact(artifactId);
        if (chatArtifact?.type === "text") {
          text = text.replace(
            new RegExp(`<artifact className="${escapeRegExp(artifactId)}"\\/>`, "g"),
            chatArtifact.content,
          );
        }
      }
    }
  } catch (error) {
    console.error("Error while extracting artifact content:", error);
  }
  return text.trimEnd();
}

type TrustedCopilotMarker = {
  type: "artifact" | "citation";
  id: string;
};

function renderTrustedCopilotMarkers(
  text: string,
  renderMarker: (marker: TrustedCopilotMarker, index: number) => ReactNode,
) {
  const markerPattern = /<(artifact|citation)\s+className="([^"]+)"\s*\/>/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let markerIndex = 0;

  for (const match of text.matchAll(markerPattern)) {
    if (match.index === undefined) continue;

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const type = match[1] as TrustedCopilotMarker["type"];
    const id = match[2];
    nodes.push(renderMarker({ type, id }, markerIndex));
    markerIndex += 1;
    lastIndex = match.index + match[0].length;
  }

  if (markerIndex === 0) return null;
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceRawImageTags(text: string) {
  return text.replace(/<img\b[^>]*>/gi, (tag) => {
    const attrs = parseHtmlTagAttributes(tag);
    const src = attrs.src?.trim();
    if (!isSafeMarkdownImageSrc(src)) return tag;

    // This is deliberately a tiny compatibility bridge for common agent output,
    // not raw HTML support: only src/alt survive and the markdown image renderer
    // applies the final URL policy.
    const alt = (attrs.alt ?? "").replace(/[\r\n[\]]/g, " ");
    return `![${alt}](${src})`;
  });
}

function parseHtmlTagAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  const attrPattern =
    /\s([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  for (const match of tag.matchAll(attrPattern)) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  return attrs;
}
