import {
  type ButtonHTMLAttributes,
  createContext,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Button } from "~/components/ds/atoms/Button";
import { cn } from "~/lib/utils";

const TabContentHeaderContext = createContext({});

interface TabContentHeaderRootProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface TabContentHeaderTitleProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface TabContentHeaderLeftProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface TabContentHeaderRightProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface TabContentHeaderDescriptionProps
  extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  onClick: () => void;
}

export const TabContentHeader = {
  Root: function Root({ children, className, ...props }: TabContentHeaderRootProps) {
    return (
      <TabContentHeaderContext.Provider value={{}}>
        <div
          className={cn(
            "@container p-2 pb-6 border-b border-light-300 dark:border-dark-750",
            className,
          )}
          {...props}
        >
          <div className="flex justify-between items-start @lg:items-center flex-col @lg:flex-row gap-3 @lg:gap-10">
            {children}
          </div>
        </div>
      </TabContentHeaderContext.Provider>
    );
  },

  Left: function Left({ children, className, ...props }: TabContentHeaderLeftProps) {
    return (
      <div className={cn("flex flex-col gap-2 flex-1", className)} {...props}>
        {children}
      </div>
    );
  },

  Right: function Right({ children, className, ...props }: TabContentHeaderRightProps) {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 @lg:flex-row flex-col @lg:w-auto w-full",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },

  Title: function Title({ children, className, ...props }: TabContentHeaderTitleProps) {
    return (
      <div className={cn("text-sm", className)} {...props}>
        {children}
      </div>
    );
  },

  Description: function Description({
    children,
    className,
    ...props
  }: TabContentHeaderDescriptionProps) {
    return (
      <p
        className={cn("text-light-600 dark:text-dark-50 text-sm", className)}
        {...props}
      >
        {children}
      </p>
    );
  },

  ActionButton: function ActionButton({
    label,
    onClick,
    className,
    variant = "primary",
    ...props
  }: ActionButtonProps & {
    loading?: boolean;
    loadingChildren?: ReactNode;
    variant?: "primary" | "secondary" | "outlined";
  }) {
    return (
      <Button
        className={cn("whitespace-nowrap @lg:w-auto w-full", className)}
        size="sm"
        onClick={onClick}
        variant={variant}
        {...props}
      >
        {label}
      </Button>
    );
  },
};
