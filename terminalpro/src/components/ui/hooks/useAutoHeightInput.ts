import { type RefObject, useCallback, useEffect } from "react";

export function useAutoHeightInput(
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement>,
  options?: {
    value?: string;
    textContent?: string;
    offset?: number;
  },
) {
  const { value, textContent, offset = 0.5 } = options ?? {};

  const handleResize = useCallback(() => {
    if (!inputRef.current) return;
    if (value !== undefined) inputRef.current.value = value;

    const target = inputRef.current;

    // CRITICAL FIX: Skip calculation if width is 0 or unstable (during transitions)
    if (target.offsetWidth === 0) {
      return;
    }

    let contentHeight = 0;

    if (textContent !== undefined) {
      // Create a temporary div to measure the height of the content
      const tempDiv = document.createElement("div");
      tempDiv.style.visibility = "hidden";
      tempDiv.style.position = "absolute";
      tempDiv.style.width = `${target.offsetWidth}px`; // Match the width of the textarea
      tempDiv.style.font = window.getComputedStyle(target).font; // Match the font styles of the textarea
      tempDiv.style.lineHeight = window.getComputedStyle(target).lineHeight; // Match the line height of the textarea
      tempDiv.style.whiteSpace = "pre-wrap"; // Wrap text like in textarea
      tempDiv.textContent = textContent; // Set the content to measure

      document.body.appendChild(tempDiv); // Add to the body to measure
      contentHeight = tempDiv.offsetHeight; // Get the height of the content
      document.body.removeChild(tempDiv); // Clean
    }

    // Set the textarea height to be at least as tall as the content
    target.style.height = "auto"; // Reset the height to recalculate
    const newHeight = Math.max(target.scrollHeight, contentHeight);
    target.style.height = `${newHeight + offset}px`; // Set the new height
  }, [inputRef, value, textContent]);

  useEffect(() => {
    handleResize();
  }, [handleResize]);
}
