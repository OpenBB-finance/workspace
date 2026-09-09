import {
  type Dispatch,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useUpdateEffect } from "usehooks-ts";
import { Checkbox } from "~/components/Forms/Checkbox";
import DebouncedInput from "~/components/General/Table/DebouncedInput";
import Icon from "~/components/Icon";
import type { FMPEarningsCallTranscriptData as EarningsCallTranscript } from "~/lib/api/sdkSchemas";
import { cn } from "~/lib/utils";
import type { getTranscriptInitialState } from "../hooks";

interface SearchTranscriptProps<T = ReturnType<typeof getTranscriptInitialState>> {
  element?: EarningsCallTranscript | undefined;
  state: T;
  dispatch: Dispatch<Partial<T>>;
  cardRef?: RefObject<HTMLDivElement>;
}

function useHandleKeybinds(props: Pick<SearchTranscriptProps, "state" | "dispatch">) {
  const { state, dispatch } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeybinds = useCallback(
    (e: KeyboardEvent) => {
      if (document.activeElement !== inputRef?.current) return;

      if (e.key === "Enter" && state.globalFilter !== "" && state.wordCount > 0) {
        dispatch({ currentMatch: (state.currentMatch + 1) % state.wordCount });
      }
    },
    [state.currentMatch, state.wordCount, inputRef?.current],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeybinds);
    return () => window.removeEventListener("keydown", handleKeybinds);
  }, [handleKeybinds]);

  return inputRef;
}

function useHandleHighlight(props: SearchTranscriptProps) {
  const { element, state, dispatch, cardRef } = props;

  const countOccurrences = useCallback(
    (text: string, word: string, exactMatch: boolean) => {
      const pattern = exactMatch ? `\\b${word}\\b` : `${word}`;
      const regex = new RegExp(pattern, "gi");

      const matches = text.match(regex);

      return matches ? matches.length : 0;
    },
    [],
  );

  useEffect(() => {
    if (state.globalFilter === "") {
      dispatch({ wordCount: 0, currentMatch: 0 });
    } else {
      const wordCount = countOccurrences(
        element?.content,
        state.globalFilter,
        state.exactMatch,
      );

      const currentMatch = state.updated ? 0 : state.currentMatch;
      dispatch({ wordCount, updated: false, currentMatch });

      const elements = cardRef?.current?.querySelectorAll(".match");
      if (elements?.length) {
        elements[0].classList.add("bg-informative-200", "text-white");
      }
    }
  }, [state.globalFilter, state.exactMatch, state.updated]);

  useUpdateEffect(() => {
    const elements = cardRef?.current?.querySelectorAll(".match");
    if (elements[state.currentMatch]) {
      for (const el of elements)
        el.classList.remove("bg-informative-200", "text-white");

      elements[state.currentMatch].scrollIntoView({
        behavior: "smooth",
      });
      elements[state.currentMatch].classList.add("bg-informative-200", "text-white");
    }
  }, [state.currentMatch, state.updated]);
}

export function useSearchTranscript(props: SearchTranscriptProps) {
  const { element, state, dispatch, cardRef } = props;

  useHandleHighlight({ element, state, dispatch, cardRef });
  const inputRef = useHandleKeybinds({ state, dispatch });

  const searchNavElement = useMemo(() => {
    return (
      <>
        <DebouncedInput
          key={element?.id}
          ref={inputRef}
          className="obb-minimal-input"
          placeholder="Search"
          value={state.globalFilter}
          onChange={(value) => dispatch({ globalFilter: value as string })}
        />
        {state.globalFilter !== "" && state.wordCount > 0 && (
          <span className="text-ds-text-body">
            {state.currentMatch + 1}/{state.wordCount}
          </span>
        )}
        <div className="inline-flex gap-1">
          <button
            disabled={
              state.currentMatch === 0 ||
              state.globalFilter === "" ||
              state.wordCount === 0
            }
            onClick={() => {
              dispatch({ currentMatch: (state.currentMatch - 1) % state.wordCount });
            }}
            className={cn(
              "w-4 h-4 flex items-center justify-center rounded-[2px]",
              "disabled:bg-general-bg-primary-disabled disabled:text-general-label-disabled",
              "bg-general-label text-general-bg-primary",
            )}
          >
            <Icon id="chevron-right-icon" className="w-3! h-3! rotate-180" />
          </button>
          <button
            disabled={
              state.currentMatch + 1 === state.wordCount ||
              state.globalFilter === "" ||
              state.wordCount === 0
            }
            onClick={() => {
              dispatch({ currentMatch: (state.currentMatch + 1) % state.wordCount });
            }}
            className={cn(
              "w-4 h-4 flex items-center justify-center rounded-[2px]",
              "disabled:bg-general-bg-primary-disabled disabled:text-general-label-disabled",
              "bg-general-label text-general-bg-primary",
            )}
          >
            <Icon id="chevron-right-icon" className="w-3! h-3!" />
          </button>
        </div>
        <Checkbox
          labelClassname="whitespace-nowrap"
          extraRootClassname="gap-2!"
          id="exact-match"
          checked={state.exactMatch}
          onChange={(exactMatch) => dispatch({ exactMatch })}
          rightLabel="Exact Match"
        />
      </>
    );
  }, [
    state.globalFilter,
    state.exactMatch,
    state.wordCount,
    state.currentMatch,
    state.updated,
    dispatch,
  ]);

  return searchNavElement;
}
