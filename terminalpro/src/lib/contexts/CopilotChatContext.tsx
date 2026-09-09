import {
  createContext,
  type MutableRefObject,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
} from "react";
import { useGetCopilotWidgets } from "~/components/AI/hooks/useGetCopilotWidgets";
import { useInitMentions } from "~/components/AI/hooks/useMentions";
import type { HandleSubmitParams } from "~/components/AI/hooks/useStreaming";

export type CopilotContextType = {
  handleSubmitRef?: MutableRefObject<(params?: HandleSubmitParams) => void>;
  stopSubmitRef?: MutableRefObject<() => void>;
  commandRef: MutableRefObject<string>;
};

export const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

export const useCopilotContext = () => {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error("useCopilotContext must be used within a CopilotProvider");
  }
  return context;
};

export function CopilotProvider({ children }: { children: ReactNode }) {
  const commandRef = useRef(localStorage.getItem("command") || ""); // Load 'command' from local storage
  const handleSubmitRef = useRef<(params?: HandleSubmitParams) => void>();
  const stopSubmitRef = useRef<() => void>();

  useGetCopilotWidgets();
  useInitMentions();

  const childrenMemo = useMemo(() => children, [children]);

  const contextValue = useMemo(
    () => ({
      commandRef,
      handleSubmitRef,
      stopSubmitRef,
    }),
    [commandRef, handleSubmitRef, stopSubmitRef],
  );

  return (
    <CopilotContext.Provider value={contextValue}>
      {childrenMemo}
    </CopilotContext.Provider>
  );
}
