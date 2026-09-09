import { memo, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

interface EdgeHoverZoneProps {
  side: "left" | "right";
  onHoverChange: (isHovered: boolean) => void;
}

/**
 * EdgeHoverZone - Invisible hover detection area for expanding collapsed panels
 *
 * Creates a 50px invisible hover zone at the screen edge. When hovered, it calls
 * onHoverChange(true) which the parent uses to show the existing expand button
 * in ResizableHandle. Includes a 200ms hide delay to prevent flickering.
 *
 * Only renders on pointer devices (not touch).
 */
export const EdgeHoverZone = memo(({ side, onHoverChange }: EdgeHoverZoneProps) => {
  const [isPointerDevice, setIsPointerDevice] = useState(true);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect pointer device (mouse) vs touch
  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: fine)");
    setIsPointerDevice(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsPointerDevice(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    onHoverChange(true);
  }, [side, onHoverChange]);

  const handleMouseLeave = useCallback(() => {
    // 200ms delay before hiding to prevent flickering
    hideTimeoutRef.current = setTimeout(() => {
      onHoverChange(false);
    }, 200);
  }, [side, onHoverChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Don't render on touch devices
  if (!isPointerDevice) {
    return null;
  }

  const isLeft = side === "left";

  return (
    <div
      className={cn(
        "fixed top-0 bottom-0 z-40 pointer-events-auto",
        // 10px gap at edge preserves resize handle drag functionality (hit area is ~5px)
        isLeft ? "left-[10px] w-[10px]" : "right-[10px] w-[10px]",
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  );
});

EdgeHoverZone.displayName = "EdgeHoverZone";
