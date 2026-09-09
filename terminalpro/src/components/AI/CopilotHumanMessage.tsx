import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { UploadedFile } from "~/components/General/UploadedFile";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { useCopilotContext } from "~/lib/contexts/CopilotChatContext";
import { type HumanMessage, useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowPromptLibraryStore } from "~/lib/state/promptLibrary";
import { Button } from "../ds/atoms/Button";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { StreamingStatus, useShallowStreamingStore } from "./hooks/useStreaming";
import TextArea from "./TextArea";
import TextStyle from "./TextStyle";

type CopilotHumanMessageProps = {
  message: HumanMessage;
};

export default function CopilotHumanMessage(props: CopilotHumanMessageProps) {
  const { message } = props;

  const copilot = useShallowCopilotStore((state) => ({
    clearMessagesAfter: state.clearMessagesAfter,
    removeUnreachableArtifacts: state.removeUnreachableArtifacts,
    updateLastMessageError: state.updateLastMessageError,
    setTitleNeedsUpdate: state.setTitleNeedsUpdate,
    showDatetime: state.showDatetime,
    hideDatetime: state.hideDatetime,
    currentChat: state.currentChat,
  }));

  const addPrompt = useShallowPromptLibraryStore((state) => state.addPrompt);

  const handleSubmitRef = useCopilotContext().handleSubmitRef;
  const dispatch = useShallowStreamingStore((state) => state.dispatch);

  const [editEnabled, setEditEnabled] = useState(false);
  const [prompt, setPrompt] = useState(message?.content);

  const handleSendMessage = useCallback(
    (question: string | undefined) => {
      if (!question) return;
      setEditEnabled(false);
      copilot.setTitleNeedsUpdate(copilot.currentChat, true);
      // TODO: This needs a fix, the function should either clear or update, not both
      copilot.clearMessagesAfter(message?.timestamp, question);
      copilot.removeUnreachableArtifacts();
      copilot.updateLastMessageError(false);
      dispatch(StreamingStatus.READY);
      handleSubmitRef.current?.({
        question,
        addHumanMessage: false,
      });
    },
    [message?.timestamp, copilot, dispatch, handleSubmitRef],
  );

  const resendCbRef = useCallbackRef(() => handleSendMessage(prompt));

  const handleSaveToLibrary = useCallback(() => {
    if (!message?.content) return;

    addPrompt({
      prompt: message.content,
      widgets: [],
    });
    toast.success("Prompt stored in prompt library");
  }, [message?.content, addPrompt]);

  const formattedDateTime = useMemo(() => {
    return dayjs(message.timestamp).format("MMM DD, YYYY • h:mm A");
  }, [message.timestamp]);

  const contentMemo = useMemo(
    () => (
      <div className="relative group w-full mt-2 mb-2">
        <div
          className="max-w-[80%] bg-brand-main/10 dark:bg-brand-main/20
        prose-sm text-xs! ml-auto text-white min-w-10 rounded"
        >
          <div className="p-2.5">
            <TextStyle
              className="p-1 text-ds-text-subtitle break-words overflow-hidden whitespace-pre-wrap"
              content={message?.content}
            />
          </div>
        </div>

        {message.files?.length ? (
          <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
            {message.files.map((file) => (
              <UploadedFile
                key={file.stored_file_uuid ?? file.name}
                name={file.name}
                readOnly={true}
                className="max-w-64"
              />
            ))}
          </div>
        ) : null}

        {/* Datetime tooltip - positioned above the bubble */}
        <div
          className="absolute -top-5 right-1 opacity-0 group-hover:opacity-100
          transition-opacity duration-200 z-10 pointer-events-none"
        >
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {formattedDateTime}
          </span>
        </div>

        <div className="absolute -bottom-6 right-0.25 flex z-50">
          <Tooltip message="Save to prompt library">
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.25"
              onClick={handleSaveToLibrary}
            >
              <Icon
                id="prompt-add"
                className="size-3.5 text-light-600 dark:text-light-300"
              />
            </button>
          </Tooltip>
          <Tooltip message="Edit">
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.25"
              onClick={() => setEditEnabled(true)}
            >
              <Icon
                id="pencil-04"
                className="size-3.5 text-light-600 dark:text-light-300"
              />
            </button>
          </Tooltip>
          <Tooltip message="Resend">
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.25"
              onClick={resendCbRef}
            >
              <Icon
                id="repeat-04"
                className="size-3.5 text-light-600 dark:text-light-300"
              />
            </button>
          </Tooltip>
        </div>
      </div>
    ),
    [
      message?.content,
      message.files,
      resendCbRef,
      message.timestamp,
      formattedDateTime,
      handleSaveToLibrary,
    ],
  );

  const editButtonsMemo = useMemo(
    () => (
      <>
        <Button
          variant="outlined"
          size="xs"
          onClick={() => {
            setEditEnabled(false);
            dispatch({ editMessageCompletion: "" });
            setPrompt(message?.content || "");
          }}
        >
          Cancel
        </Button>
        <Button size="xs" onClick={resendCbRef}>
          Send
        </Button>
      </>
    ),
    [editEnabled, resendCbRef, message?.content],
  );

  if (editEnabled) {
    return (
      <div
        key={message?.timestamp}
        className="w-full p-2 dark:bg-dark-800 bg-light-50 flex flex-col rounded-sm"
      >
        <div className="bg-white dark:bg-dark-600 rounded p-2 mb-2">
          <div className="relative">
            <TextArea
              type="editMessage"
              prompt={prompt}
              setPrompt={setPrompt}
              handleSubmit={handleSendMessage}
              openSuggestionsDown={true}
            />
          </div>
        </div>
        <div className="self-end flex gap-2">{editButtonsMemo}</div>
      </div>
    );
  }

  return contentMemo;
}
