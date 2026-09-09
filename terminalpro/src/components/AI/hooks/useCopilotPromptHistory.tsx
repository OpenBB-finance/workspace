import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import { useRef } from "react";
import { useCallbackRef } from "~/hooks/useRefHooks";

type UseCopilotPromptHistoryArgs = {
  textAreaRef: RefObject<HTMLTextAreaElement>;
  questionsHistory: string[];
  currentPrompt: string;
  setPrompt: (value: string) => void;
  setCompletion: (value: string) => void;
};

/**
 * Shell-style prompt history for the copilot textarea: ArrowUp recalls older
 * prompts when the caret is on the first line, ArrowDown walks back toward the
 * newest and restores the in-progress draft once you go past it.
 *
 * Navigation state lives in refs so cycling never triggers a re-render — only
 * the existing `setPrompt` path does, exactly like a normal keystroke.
 */
export function useCopilotPromptHistory({
  textAreaRef,
  questionsHistory,
  currentPrompt,
  setPrompt,
  setCompletion,
}: UseCopilotPromptHistoryArgs) {
  // null = at the bottom (live draft); otherwise an index into questionsHistory.
  const cursorRef = useRef<number | null>(null);
  const draftRef = useRef("");

  const applyEntry = useCallbackRef((text: string) => {
    setCompletion("");
    setPrompt(text.replace(/\n+$/, "")); // trim trailing newlines
    queueMicrotask(() => {
      const el = textAreaRef.current;
      if (!el) return;
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  });

  const handleHistoryNavigation = useCallbackRef(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return false;
      if (e.metaKey || e.ctrlKey || e.altKey) return false;

      const el = textAreaRef.current;
      if (!el) return false;

      const { selectionStart, selectionEnd, value } = el;
      if (selectionStart !== selectionEnd) return false; // active selection

      if (e.key === "ArrowUp") {
        const onFirstLine = value.lastIndexOf("\n", selectionStart - 1) === -1;
        if (!onFirstLine) return false;
        if (questionsHistory.length === 0) return false;

        if (cursorRef.current === null) {
          draftRef.current = currentPrompt;
          cursorRef.current = questionsHistory.length - 1;
        } else if (cursorRef.current === 0) {
          e.preventDefault(); // already oldest — consume so the caret stays put
          return true;
        } else {
          cursorRef.current -= 1;
        }

        e.preventDefault();
        applyEntry(questionsHistory[cursorRef.current]);
        return true;
      }

      // ArrowDown
      if (cursorRef.current === null) return false; // not navigating history
      const onLastLine = value.indexOf("\n", selectionStart) === -1;
      if (!onLastLine) return false;

      e.preventDefault();
      const next = cursorRef.current + 1;
      if (next >= questionsHistory.length) {
        cursorRef.current = null;
        applyEntry(draftRef.current);
        draftRef.current = "";
      } else {
        cursorRef.current = next;
        applyEntry(questionsHistory[next]);
      }
      return true;
    },
  );

  const resetHistoryCursor = useCallbackRef(() => {
    cursorRef.current = null;
    draftRef.current = "";
  });

  return { handleHistoryNavigation, resetHistoryCursor };
}
