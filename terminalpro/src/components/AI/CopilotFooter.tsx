import { useEffect, useMemo, useRef } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { FooterLink, UploadedFile } from "~/components/General/UploadedFile";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { COPILOT_ACCEPTED_EXTENSIONS, getDefaultCopilot } from "~/lib/constants";
import { useCopilotContext } from "~/lib/contexts/CopilotChatContext";
import { useMobile } from "~/lib/providers/MobileProvider";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { cn, extractUrlsFromText } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import SnowflakeHide from "../General/SnowflakeHide";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import CopilotSwitcher from "./CopilotSwitcher";
import { useEnhancePrompt } from "./hooks/useEnhancePrompt";
import {
  StreamingStatus,
  useLocalCommand,
  useShallowStreamingStore,
} from "./hooks/useStreaming";
import { dispatchCopilotCommand } from "./hooks/utils";
import ModelPicker from "./ModelPicker";
import PromptSuggestions from "./PromptSuggestions";
import TextArea from "./TextArea";

export default function CopilotFooter() {
  const isMobile = useMobile((state) => state.isMobile);
  const { transcript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();

  const fileUploadFF = useShallowCopilotStore((s) =>
    Boolean(s.selectedCopilot?.features?.["file-upload"]),
  );

  const handleSubmitRef = useCopilotContext().handleSubmitRef;
  const { limitReached, loading, files, dispatch } = useShallowStreamingStore((s) => ({
    limitReached: s.limitReached,
    loading: s.loading,
    files: s.files,
    dispatch: s.dispatch,
  }));

  const prompt = useLocalCommand();
  const { enhancePrompt, isEnhancing } = useEnhancePrompt();

  const isPromptEmpty = useMemo(() => prompt.trim().length === 0, [prompt]);

  const hasPendingFiles = useMemo(
    () => files.some((file) => file.status === "pending"),
    [files],
  );

  useEffect(() => {
    if (transcript && listening && browserSupportsSpeechRecognition) {
      dispatchCopilotCommand(transcript);
    }
  }, [transcript, listening, browserSupportsSpeechRecognition]);
  const inputRef = useRef<HTMLDivElement | null>(null);

  const uniqueLinks = useMemo(() => {
    const urls = extractUrlsFromText(prompt);
    return [...new Set(urls)];
  }, [prompt]);

  const thumbs = useMemo(() => {
    if (files.length === 0) return null;
    return files.map((file) => (
      <UploadedFile
        key={file.name}
        name={file.name}
        status={file.status}
        onClick={() => {
          dispatch({
            files: (prev) => prev.filter((f) => f.name !== file.name),
          });
        }}
        className="max-w-64 shrink-0"
      />
    ));
  }, [files, dispatch]);

  const thumbsLinks = useMemo(() => {
    if (uniqueLinks.length === 0) return null;
    return uniqueLinks.map((link) => <FooterLink key={link} link={link} />);
  }, [uniqueLinks]);

  const fileLinksFooterMemo = useMemo(() => {
    return (
      (thumbs || thumbsLinks) && (
        <aside className="flex gap-2 mx-2 overflow-x-auto items-center">
          {thumbs}
          {thumbsLinks}
        </aside>
      )
    );
  }, [thumbs, thumbsLinks]);

  const promptSuggestionsMemo = useMemo(
    () => (
      <PromptSuggestions setCompletion={(completion) => dispatch({ completion })} />
    ),
    [dispatch],
  );

  const onSendClick = useCallbackRef((e) => {
    e.preventDefault();
    if (isPromptEmpty && !loading) return;
    if (hasPendingFiles && !loading) return;
    if (loading) dispatch(StreamingStatus.STOPPED);

    handleSubmitRef.current?.({ question: prompt });
  });

  const onEnhanceClick = useCallbackRef(async (e) => {
    e.preventDefault();
    if (loading || limitReached || isEnhancing) return;

    try {
      const enhancedText = await enhancePrompt(prompt);
      dispatchCopilotCommand(enhancedText);
    } catch (error) {
      console.error("Failed to enhance prompt:", error);
    }
  });

  const buttonsMemo = useMemo(
    () => (
      <>
        <div className="flex p-1 items-center justify-end">
          <div className="flex gap-2 items-center w-full">
            <SnowflakeHide render={<SnowflakeSwitcher />}>
              <CopilotSwitcher />
            </SnowflakeHide>
            <ModelPicker />
            <div className="flex shrink-0 gap-1 items-center">
              {isMobile && browserSupportsSpeechRecognition ? (
                <button
                  type="button"
                  aria-label={listening ? "Stop voice input" : "Start voice input"}
                  aria-pressed={listening}
                  onClick={() =>
                    listening
                      ? SpeechRecognition.stopListening()
                      : SpeechRecognition.startListening()
                  }
                  disabled={loading || limitReached}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded transition-colors duration-200 min-w-8",
                    {
                      "opacity-25 cursor-default": loading || limitReached,
                      "text-ds-text-body hover:bg-btn-ghost-bg-hover":
                        !loading && !limitReached,
                      "bg-brand-main/10": listening,
                    },
                  )}
                >
                  <Icon
                    id={listening ? "ph-microphone-slash-fill" : "ph-microphone-fill"}
                    className={cn("h-4 w-4 stroke-1", {
                      "animate-pulse text-brand-main dark:text-brand-lighter":
                        listening,
                    })}
                  />
                </button>
              ) : (
                promptSuggestionsMemo
              )}

              <SnowflakeHide>
                <Tooltip
                  message={
                    fileUploadFF
                      ? `Attach files (${COPILOT_ACCEPTED_EXTENSIONS.filter(
                          (e) => e !== ".markdown",
                        )
                          .map((e) => e.slice(1).toUpperCase())
                          .join(", ")} supported)`
                      : "File upload is not enabled for this copilot."
                  }
                >
                  <div className="tooltip-wrapper">
                    <button
                      type="button"
                      aria-label="Attach files"
                      onClick={() => document.getElementById("file-upload")?.click()}
                      disabled={!fileUploadFF || loading || limitReached}
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded transition-colors duration-200 min-w-8",
                        {
                          "opacity-25 cursor-default":
                            !fileUploadFF || loading || limitReached,
                          "text-ds-text-body hover:bg-btn-ghost-bg-hover":
                            fileUploadFF && !loading && !limitReached,
                        },
                      )}
                    >
                      <Icon id="attachment-icon" className="h-4 w-4 stroke-1" />
                    </button>
                  </div>
                </Tooltip>
              </SnowflakeHide>
              <Tooltip
                message={isPromptEmpty ? "Generate prompt" : "Prompt enhancement"}
              >
                <div className="tooltip-wrapper">
                  <button
                    type="button"
                    aria-label={
                      isPromptEmpty ? "Generate prompt" : "Prompt enhancement"
                    }
                    onClick={onEnhanceClick}
                    disabled={loading || limitReached || isEnhancing}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded transition-colors duration-200 min-w-8",
                      {
                        "opacity-25 cursor-default":
                          loading || limitReached || isEnhancing,
                        "text-ds-text-body hover:bg-btn-ghost-bg-hover":
                          !loading && !limitReached && !isEnhancing,
                      },
                    )}
                  >
                    <Icon
                      id={isEnhancing ? "mdi-loading" : "sparkles-icon"}
                      className={cn("h-4 w-4 stroke-1", {
                        "animate-spin": isEnhancing,
                      })}
                    />
                  </button>
                </div>
              </Tooltip>

              <Button
                id="send-copilot-message"
                icon={true}
                size="sm"
                onClick={onSendClick}
                disabled={
                  limitReached || ((isPromptEmpty || hasPendingFiles) && !loading)
                }
                variant="primary"
              >
                {loading ? (
                  <Icon id="lucide-stop-circle" className="h-4 w-4" />
                ) : (
                  <Icon id="send" className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </>
    ),
    [
      onSendClick,
      onEnhanceClick,
      limitReached,
      loading,
      fileUploadFF,
      isMobile,
      isPromptEmpty,
      hasPendingFiles,
      isEnhancing,
      browserSupportsSpeechRecognition,
      listening,
      promptSuggestionsMemo,
    ],
  );

  const textAreaMemo = useMemo(() => <TextArea type="footer" />, []);

  return useMemo(
    () => (
      <>
        <div
          id="copilot-chat-footer"
          ref={inputRef}
          className="mt-auto rounded-b border-b border-l border-r border-general-border-primary bg-general-bg-primary p-1"
        >
          <div className="flex flex-col gap-2 w-full notranslate">
            <div
              className={cn(
                "mx-2 mt-1 bg-transparent relative w-[calc(100%-1rem)] min-h-[75px]",
                {
                  "opacity-50": limitReached,
                },
              )}
            >
              <div className="relative">{textAreaMemo}</div>
            </div>
            {fileLinksFooterMemo}
            {buttonsMemo}
          </div>
        </div>
      </>
    ),
    [limitReached, textAreaMemo, buttonsMemo, fileLinksFooterMemo],
  );
}

function SnowflakeSwitcher() {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center text-xs gap-1 w-full min-w-0">
        <span
          className="flex items-center gap-1 rounded-full px-2 py-1 dark:bg-dark-750 bg-light-50
          dark:text-light-200 text-light-750 min-w-0 max-w-full truncate"
        >
          <Icon
            id="sparkles-icon"
            className="h-4 w-4 dark:text-light-400 flex-shrink-0"
          />
          <span className="select-none truncate min-w-0">
            {getDefaultCopilot().name}
          </span>
        </span>
      </div>
    </div>
  );
}
