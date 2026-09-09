import type { ReactNode } from "react";
import { cn } from "~/components/ds/utils";

interface DetailRowProps {
  label: string;
  children: ReactNode;
  /** Widens the label column; admin review rows carry longer labels. */
  labelClassName?: string;
}

/** Label/value row shared by the listing details view and the admin review dialog. */
export function DetailRow({ label, children, labelClassName }: DetailRowProps) {
  return (
    <div className="flex items-start gap-4 border-b border-general-border-secondary py-2.5 first:pt-0 last:border-b-0 last:pb-0">
      <span
        className={cn(
          "w-24 shrink-0 body-xs-regular text-ds-text-caption",
          labelClassName,
        )}
      >
        {label}
      </span>
      <div className="min-w-0 flex-1 body-xs-regular text-ds-text-body break-words">
        {children}
      </div>
    </div>
  );
}
