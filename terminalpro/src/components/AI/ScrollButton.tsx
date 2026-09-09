import {
  type MutableRefObject,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocalStorage } from "usehooks-ts";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import Icon from "../Icon";
import { useShallowStreamingStore } from "./hooks/useStreaming";

// How far from the bottom (px) the user can be for us to still hide the scroll button.
// Generous so the button doesn't flicker when citations expand, etc.
const BUTTON_VISIBILITY_THRESHOLD = 100;

// How far from the absolute bottom (px) we consider "at the bottom" for auto-scroll purposes.
// Tight so we never forcefully snap the viewport while the user is still scrolling.
const AUTO_SCROLL_THRESHOLD = 10;

export type ScrollButtonProps = {
  messagesRef: MutableRefObject<HTMLDivElement | null>;
};

export function ScrollButton(props: ScrollButtonProps) {
  const { messagesRef } = props;

  const { limitReached, isStreaming, loading } = useShallowStreamingStore((s) => ({
    limitReached: s.limitReached,
    isStreaming: s.streamingStatus === "streaming-started",
    loading: s.loading,
  }));

  const [streamedData] = useLocalStorage("streamedData", "");

  const showWelcome = useShallowCopilotStore((s) => s.showWelcome);

  // Ref controls auto-scroll suppression. Using a ref (not state) is intentional:
  // scroll events fire at high frequency and we must NOT trigger React effects/re-renders
  // every time the user crosses the threshold — that was the source of the snap-to-bottom bug.
  const userScrolledAwayRef = useRef(false);

  // State controls button visibility — the only scroll-derived value that needs a re-render.
  const [showScrollButton, setShowScrollButton] = useState(false);

  const handleUserScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    userScrolledAwayRef.current = distanceFromBottom > AUTO_SCROLL_THRESHOLD;
    setShowScrollButton(distanceFromBottom > BUTTON_VISIBILITY_THRESHOLD);
  }, [messagesRef]);

  useEffect(() => {
    const scrollElement = messagesRef.current;
    if (!scrollElement) return;

    scrollElement.addEventListener("scroll", handleUserScroll, { passive: true });
    return () => scrollElement.removeEventListener("scroll", handleUserScroll);
  }, [handleUserScroll, messagesRef]);

  // Auto-scroll while streaming, only when the user hasn't scrolled away
  useEffect(() => {
    if ((isStreaming || limitReached) && !userScrolledAwayRef.current) {
      const animationFrame = requestAnimationFrame(() => {
        if (messagesRef.current) {
          messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
      });

      return () => cancelAnimationFrame(animationFrame);
    }
  }, [loading, limitReached, streamedData, isStreaming, messagesRef]);

  // Keep the user at the bottom when new content arrives (e.g. new message, loading state change)
  // but only if they haven't intentionally scrolled away.
  useEffect(() => {
    if (!userScrolledAwayRef.current || limitReached) {
      if (messagesRef.current) {
        messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
      }
    }
  }, [limitReached, streamedData, loading, messagesRef]);

  const handleScrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      const element = messagesRef.current;
      const start = element.scrollTop;
      const target = element.scrollHeight - element.clientHeight;
      const distance = target - start;
      const duration = 800;
      let startTime: number | null = null;

      const animateScroll = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);

        const easeOutCubic = 1 - (1 - progress) ** 3;

        element.scrollTop = start + distance * easeOutCubic;

        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      };

      requestAnimationFrame(animateScroll);
    }

    userScrolledAwayRef.current = false;
    setShowScrollButton(false);
  }, [messagesRef]);

  const buttonMemo = useMemo(
    () => (
      <button
        type="button"
        onClick={handleScrollToBottom}
        aria-label="Scroll to latest message"
        className="absolute left-1/2 -translate-x-1/2 bottom-2 z-10
          flex items-center justify-center h-8 w-8 rounded-full
          bg-general-bg-primary/90 backdrop-blur-sm
          border border-general-border-primary
          text-ds-text-body hover:text-ds-text-heading
          hover:bg-general-bg-primary-hover
          shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]
          transition-colors duration-150"
      >
        <Icon id="chevron-down" className="h-3.5 w-3.5" />
      </button>
    ),
    [handleScrollToBottom],
  );

  const shouldShowButton =
    !(loading || showWelcome) &&
    streamedData === "" &&
    showScrollButton &&
    messagesRef.current?.scrollHeight > messagesRef.current?.clientHeight;

  return shouldShowButton && buttonMemo;
}

export default memo(ScrollButton);
