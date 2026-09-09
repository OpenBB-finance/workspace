import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCopilotPromptHistory } from "~/components/AI/hooks/useCopilotPromptHistory";

type KeyOverrides = Partial<{
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}>;

function makeKey(key: string, overrides: KeyOverrides = {}) {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as React.KeyboardEvent<HTMLTextAreaElement>;
}

function makeRef({
  value = "",
  selectionStart = 0,
  selectionEnd,
}: { value?: string; selectionStart?: number; selectionEnd?: number } = {}) {
  return {
    current: {
      value,
      selectionStart,
      selectionEnd: selectionEnd ?? selectionStart,
      setSelectionRange: vi.fn(),
    },
  } as any;
}

function setup({
  questionsHistory = [] as string[],
  currentPrompt = "",
  ref = makeRef(),
}: {
  questionsHistory?: string[];
  currentPrompt?: string;
  ref?: any;
} = {}) {
  const setPrompt = vi.fn();
  const setCompletion = vi.fn();
  const { result, rerender } = renderHook(
    (props: { currentPrompt: string; questionsHistory: string[] }) =>
      useCopilotPromptHistory({
        textAreaRef: ref,
        questionsHistory: props.questionsHistory,
        currentPrompt: props.currentPrompt,
        setPrompt,
        setCompletion,
      }),
    { initialProps: { currentPrompt, questionsHistory } },
  );
  return { result, rerender, setPrompt, setCompletion, ref };
}

describe("useCopilotPromptHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ArrowUp from empty input recalls the most recent prompt", () => {
    const { result, setPrompt } = setup({ questionsHistory: ["old", "new"] });
    const handled = result.current.handleHistoryNavigation(makeKey("ArrowUp"));
    expect(handled).toBe(true);
    expect(setPrompt).toHaveBeenCalledWith("new");
  });

  it("repeated ArrowUp walks newest -> oldest then clamps at oldest", () => {
    const { result, setPrompt } = setup({ questionsHistory: ["a", "b", "c"] });
    result.current.handleHistoryNavigation(makeKey("ArrowUp")); // c
    result.current.handleHistoryNavigation(makeKey("ArrowUp")); // b
    result.current.handleHistoryNavigation(makeKey("ArrowUp")); // a
    const clamp = makeKey("ArrowUp");
    const handled = result.current.handleHistoryNavigation(clamp); // stay on a
    expect(setPrompt.mock.calls.map((c) => c[0])).toEqual(["c", "b", "a"]);
    expect(handled).toBe(true); // consumed so caret does not jump
    expect(clamp.preventDefault).toHaveBeenCalled();
  });

  it("ArrowDown walks back toward newest and restores the draft past newest", () => {
    const { result, setPrompt } = setup({
      questionsHistory: ["a", "b"],
      currentPrompt: "my draft",
    });
    result.current.handleHistoryNavigation(makeKey("ArrowUp")); // b (newest)
    result.current.handleHistoryNavigation(makeKey("ArrowUp")); // a (oldest)
    result.current.handleHistoryNavigation(makeKey("ArrowDown")); // b
    result.current.handleHistoryNavigation(makeKey("ArrowDown")); // draft
    expect(setPrompt.mock.calls.map((c) => c[0])).toEqual([
      "b",
      "a",
      "b",
      "my draft",
    ]);
  });

  it("ArrowDown does nothing when not navigating history", () => {
    const { result, setPrompt } = setup({ questionsHistory: ["a"] });
    const handled = result.current.handleHistoryNavigation(makeKey("ArrowDown"));
    expect(handled).toBe(false);
    expect(setPrompt).not.toHaveBeenCalled();
  });

  it("clears ghost completion when recalling", () => {
    const { result, setCompletion } = setup({ questionsHistory: ["a"] });
    result.current.handleHistoryNavigation(makeKey("ArrowUp"));
    expect(setCompletion).toHaveBeenCalledWith("");
  });

  it("ignores empty history", () => {
    const { result, setPrompt } = setup({ questionsHistory: [] });
    const handled = result.current.handleHistoryNavigation(makeKey("ArrowUp"));
    expect(handled).toBe(false);
    expect(setPrompt).not.toHaveBeenCalled();
  });

  it("does not trigger when a text selection is active", () => {
    const ref = makeRef({ value: "hello", selectionStart: 0, selectionEnd: 5 });
    const { result, setPrompt } = setup({ questionsHistory: ["a"], ref });
    const handled = result.current.handleHistoryNavigation(makeKey("ArrowUp"));
    expect(handled).toBe(false);
    expect(setPrompt).not.toHaveBeenCalled();
  });

  it("does not trigger ArrowUp when caret is not on the first line", () => {
    const ref = makeRef({ value: "line1\nline2", selectionStart: 8 });
    const { result, setPrompt } = setup({ questionsHistory: ["a"], ref });
    const handled = result.current.handleHistoryNavigation(makeKey("ArrowUp"));
    expect(handled).toBe(false);
    expect(setPrompt).not.toHaveBeenCalled();
  });

  it("ignores modifier-key combos (caret jump)", () => {
    const { result, setPrompt } = setup({ questionsHistory: ["a"] });
    expect(
      result.current.handleHistoryNavigation(makeKey("ArrowUp", { metaKey: true })),
    ).toBe(false);
    expect(
      result.current.handleHistoryNavigation(makeKey("ArrowUp", { ctrlKey: true })),
    ).toBe(false);
    expect(
      result.current.handleHistoryNavigation(makeKey("ArrowUp", { altKey: true })),
    ).toBe(false);
    expect(setPrompt).not.toHaveBeenCalled();
  });

  it("resetHistoryCursor re-enters from the bottom and re-stashes the live draft", () => {
    const { result, rerender, setPrompt } = setup({
      questionsHistory: ["a"],
      currentPrompt: "first",
    });
    result.current.handleHistoryNavigation(makeKey("ArrowUp")); // stash "first", show "a"
    result.current.resetHistoryCursor(); // user edited
    rerender({ currentPrompt: "second", questionsHistory: ["a"] });
    result.current.handleHistoryNavigation(makeKey("ArrowUp")); // show "a" again
    result.current.handleHistoryNavigation(makeKey("ArrowDown")); // restore new draft
    expect(setPrompt.mock.calls.map((c) => c[0])).toEqual(["a", "a", "second"]);
  });
});
