import type { ReactNode } from "react";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";
import { cn } from "../utils";

export type NoticeVariant = "success" | "warning" | "error" | "info";

const VARIANT_STYLES: Record<NoticeVariant, { box: string; accent: string }> = {
  success: {
    box: "bg-success-100/15 border-success-100/25",
    accent: "text-alert-success",
  },
  warning: {
    box: "bg-warning-100/15 border-warning-100/25",
    accent: "text-alert-warning",
  },
  error: { box: "bg-error-100/15 border-error-100/25", accent: "text-alert-error" },
  info: {
    box: "bg-informative-100/15 border-informative-100/25",
    accent: "text-alert-informative",
  },
};

const VARIANT_ICONS: Record<NoticeVariant, IconId> = {
  success: "check-circle",
  warning: "exclamation-outline-triangle",
  error: "warning-icon",
  info: "info-circle",
};

export interface NoticeProps {
  variant: NoticeVariant;
  title: string;
  /** Overrides the default per-variant icon. */
  icon?: IconId;
  /** Body content. Accepts a node so callers can embed code blocks, links, etc. */
  children?: ReactNode;
  className?: string;
}

/**
 * Contextual banner (icon + title + optional body) for feedback that lives inline
 * in a form or dialog. Shares the box treatment with {@link ConnectionTestResult}
 * but adds warning/info variants and a node body. Theme-aware: a translucent accent
 * tint keeps the box subtle in both light and dark mode, with a colored icon and
 * neutral title/body text.
 */
export function Notice({ variant, title, icon, children, className }: NoticeProps) {
  const style = VARIANT_STYLES[variant];

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded border-2 p-4",
        style.box,
        className,
      )}
    >
      <Icon
        id={icon ?? VARIANT_ICONS[variant]}
        className={cn("h-5 w-5 flex-shrink-0", style.accent)}
      />
      <div className="flex flex-col gap-0.5">
        <p className="body-sm-medium text-ds-text-title">{title}</p>
        {children && (
          <div className="body-xs-regular text-ds-text-body">{children}</div>
        )}
      </div>
    </div>
  );
}
Notice.displayName = "Notice";
