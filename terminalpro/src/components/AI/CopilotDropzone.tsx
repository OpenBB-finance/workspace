import isEqual from "lodash.isequal";
import {
  Fragment,
  type MutableRefObject,
  memo,
  type ReactNode,
  useEffect,
  useMemo,
} from "react";
import { useDropzone } from "react-dropzone";
import { useDebouncedCallback } from "use-debounce";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { useCallbackRef, useComposeRefs } from "~/hooks/useRefHooks";
import { COPILOT_ACCEPTED_MIME_TYPES } from "~/lib/constants";
import type { Selector } from "~/lib/state/app";
import { type CopilotFile, useShallowCopilotStore } from "~/lib/state/copilot";
import { cn, slugifyWithExtension } from "~/lib/utils";
import DragFileHere from "./DragFileHere";
import useQueriesLeft from "./hooks/useQueriesLeft";
import { useShallowStreamingStore } from "./hooks/useStreaming";
import { updateFileStatus, useUploadDocuments } from "./hooks/useUploadDocuments";

type CopilotDropzoneProps = {
  children: ReactNode;
  messagesRef: MutableRefObject<HTMLDivElement | null>;
};

export function CopilotDropzone(props: CopilotDropzoneProps) {
  const { children, messagesRef } = props;

  const { dispatch, isDragging } = useShallowStreamingStore((state) => ({
    dispatch: state.dispatch,
    isDragging: state.isDragging,
  }));
  const queriesLeft = useQueriesLeft()?.queriesLeft;
  const uploadDocuments = useUploadDocuments();
  const showWelcome = useShallowCopilotStore((state) => state.showWelcome);

  const copilot = useShallowCopilotStore((s) => ({
    selectedCopilot: s.selectedCopilot,
  }));

  const { rootRef, getRootProps, getInputProps, isDragActive } = useDropzone({
    noClick: true,
    accept: COPILOT_ACCEPTED_MIME_TYPES,
    multiple: true,
    disabled: !copilot.selectedCopilot?.features?.["file-upload"] || queriesLeft === 0,
    onDrop: (acceptedFiles) => {
      const acceptedFilesSlugified = acceptedFiles.map((file) => {
        return new File([file], slugifyWithExtension(file.name), { type: file.type });
      });
      const newFiles = acceptedFilesSlugified.map((file) => ({
        name: file.name,
        status: "pending" as const,
      })) as CopilotFile[];

      dispatch({ files: (prevFiles) => [...prevFiles, ...newFiles] });
      uploadDocuments(acceptedFilesSlugified).catch((e) => {
        console.error(e);
        dispatch({
          files: (prevFiles) => updateFileStatus(prevFiles, acceptedFilesSlugified),
        });
      });

      setTimeout(() => {
        messagesRef.current.scrollTop = messagesRef.current?.scrollHeight;
        const input = document.getElementById("file-upload") as HTMLInputElement;
        if (input) input.value = null;
      });
    },
  });

  // This fixes flickering when dragging files
  const composeRefs = useComposeRefs(messagesRef, rootRef);
  const childrenMemo = useMemo(() => children, [children]);
  useCopilotSetScrollY(messagesRef);

  return useMemo(
    () => (
      <div
        key="copilot-dropzone"
        {...getRootProps()}
        className={cn("overflow-y-auto px-0.5 h-full scroll-auto relative", {
          "flex items-center justify-center": showWelcome || isDragging,
        })}
        ref={composeRefs}
        id="message-box"
      >
        {isDragActive ? (
          <DragFileHere />
        ) : (
          <Fragment key="copilot-dropzone-children">
            {childrenMemo}
            <input id="file-upload" {...getInputProps()} />
          </Fragment>
        )}
      </div>
    ),
    [childrenMemo, isDragActive, showWelcome, isDragging, composeRefs, getRootProps],
  );
}

function useCopilotSetScrollY(messagesRef: MutableRefObject<HTMLDivElement | null>) {
  const currentChat = useShallowCopilotStore((state) => state.currentChat);
  const isDragging = useShallowStreamingStore((state) => state.isDragging);

  const { getScrollY, setCopilotScrollY } = useShallowCopilotScrollYStore((state) => ({
    getScrollY: state.getScrollY,
    setCopilotScrollY: state.setCopilotScrollY,
  }));

  const debouncedSetCopilotScrollY = useDebouncedCallback(
    (scrollY: number) => !isDragging && setCopilotScrollY(currentChat, scrollY),
    300,
    { maxWait: 500, leading: true },
  );

  const handleScrollTo = useCallbackRef((chatId: number) => {
    const scrollY = getScrollY(chatId) ?? messagesRef.current?.scrollHeight;
    messagesRef.current?.scrollTo({ top: scrollY, behavior: "auto" });
  });

  useEffect(() => {
    if (!messagesRef.current) return;
    handleScrollTo(currentChat);
  }, [messagesRef.current, handleScrollTo]);

  useEffect(() => {
    if (!messagesRef.current || isDragging) return;

    queueMicrotask(() => handleScrollTo(currentChat));
  }, [currentChat, isDragging, handleScrollTo]);

  const handleScroll = useCallbackRef(() => {
    if (!messagesRef.current) return;
    debouncedSetCopilotScrollY(messagesRef.current?.scrollTop);
  });

  useEffect(() => {
    if (!messagesRef.current) return;

    messagesRef.current.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      messagesRef.current?.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll, messagesRef]);
}

interface CopilotScrollYState {
  copilotScrollY: Record<string, number>;
  setCopilotScrollY: (key: number, scrollY: number) => void;
  getScrollY: (key: number) => number;
}

export const useCopilotScrollYStore = createWithEqualityFn<CopilotScrollYState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      copilotScrollY: {},
      setCopilotScrollY: (key, scrollY) =>
        set((state) => ({
          copilotScrollY: { ...state.copilotScrollY, [key]: scrollY },
        })),
      getScrollY: (key) => get().copilotScrollY[key],
    })),
    { name: "copilotScrollY" },
  ),
);

export function useShallowCopilotScrollYStore<S extends CopilotScrollYState, T>(
  selector: Selector<S, T>,
): T {
  return useCopilotScrollYStore(useShallow(selector), (prev, next) =>
    isEqual(prev, next),
  );
}

export default memo(CopilotDropzone);
