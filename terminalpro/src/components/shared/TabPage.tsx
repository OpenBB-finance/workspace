import { forwardRef, type ReactNode } from "react";
import { AnimatedChevron } from "~/components/ds/atoms/AnimatedChevron";
import { Input } from "~/components/ds/atoms/Input";
import Icon from "~/components/Icon";
import { cn } from "~/lib/utils";

interface TabPageLayoutProps {
  children: ReactNode;
  className?: string;
}

export function TabPageLayout({ children, className }: TabPageLayoutProps) {
  return <div className={cn("flex flex-col gap-4 p-6", className)}>{children}</div>;
}

interface TabPageToolbarProps {
  children: ReactNode;
  className?: string;
}

export function TabPageToolbar({ children, className }: TabPageToolbarProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2 flex-wrap", className)}>
      {children}
    </div>
  );
}

interface TabPageSearchInputProps {
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export const TabPageSearchInput = forwardRef<HTMLInputElement, TabPageSearchInputProps>(
  ({ defaultValue, onChange, placeholder = "Search...", className }, ref) => {
    return (
      <Input
        ref={ref}
        prefix={<Icon id="search" />}
        placeholder={placeholder}
        className={cn("h-8 [&_input]:h-8 w-[243px]", className)}
        defaultValue={defaultValue}
        onChange={onChange}
        clearable={true}
      />
    );
  },
);

interface TabPageEmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function TabPageEmptyState({
  title,
  description,
  action,
}: TabPageEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-general-bg-primary p-12 text-center gap-2 min-h-96">
      <p className="body-sm-bold">{title}</p>
      {description && (
        <p className="body-xs-regular text-light-600 dark:text-dark-50">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

interface TabPageToolbarActionsProps {
  children: ReactNode;
  className?: string;
}

export function TabPageToolbarActions({
  children,
  className,
}: TabPageToolbarActionsProps) {
  return (
    <div
      className={cn(
        "flex p-1 items-center rounded bg-white border-light-200 dark:bg-dark-850 border dark:border-dark-750 h-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface TabPageToolbarDividerProps {
  className?: string;
}

export function TabPageToolbarDivider({ className }: TabPageToolbarDividerProps) {
  return (
    <div className={cn("w-px h-5 mx-1 bg-light-200 dark:bg-dark-400", className)} />
  );
}

interface TabPageSectionHeaderProps {
  title: string;
  count?: number;
  isOpen: boolean;
  onToggle?: () => void;
  trailingContent?: ReactNode;
  leadingIcon?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function TabPageSectionHeader({
  title,
  count,
  isOpen,
  onToggle,
  trailingContent,
  leadingIcon,
  disabled,
  className,
}: TabPageSectionHeaderProps) {
  const isInteractive = onToggle !== undefined;

  return (
    <div
      className={cn(
        "flex min-h-6 items-center gap-2 flex-1 justify-between cursor-pointer select-none",
        { "opacity-50 cursor-default": disabled },
        className,
      )}
      onClick={isInteractive ? () => !disabled && onToggle() : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (!disabled && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive && !disabled ? 0 : undefined}
    >
      <div className="flex items-center gap-2">
        <AnimatedChevron isOpen={isOpen} />
        {leadingIcon}
        <p className="body-xs-regular">
          {title}
          {count !== undefined && <span> ({count})</span>}
        </p>
      </div>
      {trailingContent}
    </div>
  );
}

interface TabPageFilterGroupProps {
  children: ReactNode;
  className?: string;
}

export function TabPageFilterGroup({ children, className }: TabPageFilterGroupProps) {
  return (
    <div className={cn("flex items-center gap-2.5 flex-wrap", className)}>
      {children}
    </div>
  );
}
