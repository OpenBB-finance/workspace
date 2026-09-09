import isEqual from "lodash.isequal";
import { type Dispatch, useCallback, useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { type DispatchAction, reducerAction } from "~/hooks/useStateReducer";
import { useCopilotContext } from "~/lib/contexts/CopilotChatContext";
import type { Selector } from "~/lib/state/app";

import type { CopilotFile } from "~/lib/state/copilot";

export type HandleSubmitParams = {
  question?: string;
  addHumanMessage?: boolean;
};

export interface StreamingState {
  streamingStatus: "streaming-ready" | "streaming-started" | "streaming-stopped";
  isDragging: boolean;
  loading: boolean;
  files: CopilotFile[];
  abortController: AbortController | null;
  allowDirectRetrievalFF: boolean;
  limitReached: boolean;
  completion: string;
  editMessageCompletion: string;
  dispatch?: (
    action: DispatchAction<StreamingState>,
    setStreamedData?: (value: string) => void,
    setStreamedCitations?: (value: any[]) => void,
  ) => void;
}
export const useStreamingStore = createWithEqualityFn<StreamingState>()(
  subscribeWithSelector((set, get) => ({
    streamingStatus: "streaming-ready",
    isDragging: false,
    loading: false,
    files: [],
    abortController: null,
    allowDirectRetrievalFF: true,
    limitReached: false,
    completion: "",
    editMessageCompletion: "",
    dispatch: (
      action: DispatchAction<StreamingState>,
      setStreamedData,
      setStreamedCitations,
    ) => {
      const { dispatch, ...state } = get();
      set(reducerAction(state, action));
      if (setStreamedData) setStreamedData("");
      if (setStreamedCitations) setStreamedCitations([]);
    },
  })),
);

export function useShallowStreamingStore<S extends StreamingState, T>(
  selector: Selector<S, T>,
): T {
  return useStreamingStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}

export type DispatchActionType = Dispatch<DispatchAction<StreamingState>>;

export const StreamingStatus = {
  READY: { streamingStatus: "streaming-ready" },
  STARTED: { streamingStatus: "streaming-started" },
  STOPPED: { streamingStatus: "streaming-stopped" },
} as { [key: string]: { streamingStatus: StreamingState["streamingStatus"] } };

export const ResetState = {
  loading: false,
  streamingStatus: "streaming-ready" as StreamingState["streamingStatus"],
};

export function useLocalCommand() {
  const commandRef = useCopilotContext()?.commandRef;
  const [command, setCommand] = useState(commandRef.current);

  useEffect(() => {
    function handleCopilotCommand(event: CustomEvent) {
      const { command } = event.detail || {};
      setCommand(command);
    }

    window.addEventListener("copilotCommand", handleCopilotCommand);

    return () => {
      window.removeEventListener("copilotCommand", handleCopilotCommand);
    };
  }, [commandRef, setCommand]);

  return command;
}

export function useStreamingHooks() {
  const commandRef = useCopilotContext()?.commandRef;

  const handleCopilotCommand = useCallback(
    (event: CustomEvent) => {
      let command = event.detail?.command;

      if (typeof command === "function") command = command(commandRef.current ?? "");

      commandRef.current = command;
    },
    [commandRef],
  );

  useEffect(() => {
    window.addEventListener("copilotCommand", handleCopilotCommand);

    return () => {
      window.removeEventListener("copilotCommand", handleCopilotCommand);
    };
  }, [handleCopilotCommand]);

  const [debouncedCommand] = useDebounce(commandRef.current, 500);

  // Use useEffect to save the 'command' field to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem("command", debouncedCommand);
  }, [debouncedCommand]);
}
