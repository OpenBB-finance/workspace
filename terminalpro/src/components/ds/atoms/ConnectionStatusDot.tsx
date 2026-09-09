import { forwardRef } from "react";
import Icon from "~/components/Icon";
import { cn } from "../utils";

export type ConnectionStatus =
  | "connected"
  | "error"
  | "warning"
  | "connecting"
  | "pending"
  | "disconnected";

const DOT_COLORS: Record<Exclude<ConnectionStatus, "pending">, string> = {
  connected: "bg-alert-success",
  error: "bg-alert-error",
  warning: "bg-alert-warning",
  connecting: "bg-alert-informative",
  disconnected: "bg-general-border-primary",
};

// Text color paired with each dot. Used when `coloredLabel` tints the whole
// indicator so the dot and label share one color (e.g. a green "● Connected",
// matching the marketplace app cards).
const LABEL_COLORS: Record<Exclude<ConnectionStatus, "pending">, string> = {
  connected: "text-alert-success",
  error: "text-alert-error",
  warning: "text-alert-warning",
  connecting: "text-alert-informative",
  disconnected: "text-ds-text-caption",
};

export interface ConnectionStatusDotProps {
  status: ConnectionStatus;
  /** Optional text shown next to the dot, e.g. "Connecting…". */
  label?: string;
  /**
   * Tint the dot and label with the status color (dot uses `currentColor`, so
   * the two always match). Off by default — the label stays a neutral caption.
   */
  coloredLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Connection status indicator: a spinner while pending, otherwise a colored dot
 * (the `connecting` status pairs a blue dot with a spinner).
 * Shared so backend / agent / MCP surfaces speak one visual status vocabulary.
 */
export const ConnectionStatusDot = forwardRef<
  HTMLSpanElement,
  ConnectionStatusDotProps
>((props, _ref) => {
  const { status, label, coloredLabel = false, size = "sm", className } = props;
  const isPending = status === "pending";
  const isConnecting = status === "connecting";
  const spinnerSize = size === "sm" ? "size-3" : "size-3.5";
  const tint = coloredLabel && !isPending ? LABEL_COLORS[status] : undefined;

  return (
    <span className={cn("inline-flex items-center gap-2", tint, className)}>
      {isPending ? (
        <Icon
          id="mdi-loading"
          className={cn("animate-spin text-link-color", spinnerSize)}
        />
      ) : (
        <span
          className={cn(
            "rounded-full",
            size === "sm" ? "size-2" : "size-2.5",
            coloredLabel ? "bg-current" : DOT_COLORS[status],
          )}
        />
      )}
      {isConnecting && (
        <Icon
          id="mdi-loading"
          className={cn("animate-spin text-alert-informative", spinnerSize)}
        />
      )}
      {label && (
        <span
          className={cn("body-xs-regular", !coloredLabel && "text-ds-text-caption")}
        >
          {label}
        </span>
      )}
    </span>
  );
});
