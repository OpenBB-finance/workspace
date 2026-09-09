import { AnimatePresence, motion } from "framer-motion";
import { type KeyboardEvent, type ReactNode, useCallback, useState } from "react";
import { cn } from "../utils";
import { collapsibleVariants } from "./collapsible-motion";

type CollapsibleSectionProps = {
  children: ReactNode;
  header: ReactNode | ((props: { isOpen: boolean }) => ReactNode);
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  duration?: number;
};

export function CollapsibleSection({
  children,
  header,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  disabled = false,
  className,
  contentClassName,
  duration = 0.2,
}: CollapsibleSectionProps) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const toggle = useCallback(() => {
    if (disabled) return;
    const next = !isOpen;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }, [disabled, isOpen, isControlled, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  const renderedHeader = typeof header === "function" ? header({ isOpen }) : header;

  return (
    <div className={cn(className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-disabled={disabled}
      >
        {renderedHeader}
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="collapsible-content"
            initial="exit"
            animate="enter"
            exit="exit"
            variants={collapsibleVariants}
            transition={{ duration }}
            className={cn("overflow-hidden", contentClassName)}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
