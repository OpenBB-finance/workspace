import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva } from "class-variance-authority";
import React from "react";
import { cn } from "../utils";

export interface TabsContextValue {
  variant?: "default" | "filled" | "filled_secondary";
}

const TabsContext = React.createContext<TabsContextValue>({
  variant: "default",
});

export interface TabsProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>,
    TabsContextValue {}

/**
 * @see {@link https://ui.shadcn.com/docs/components/tabs | Shadcn/ui Docs - Tabs} for more information
 */
export const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({ className, variant, ...props }, ref) => (
  <TabsContext.Provider value={{ variant }}>
    <TabsPrimitive.Root ref={ref} className={cn("BB-Tabs", className)} {...props} />
  </TabsContext.Provider>
));
Tabs.displayName = TabsPrimitive.Root.displayName;

export const TabListVariants = cva(["BB-TabList flex"], {
  variants: {
    variant: {
      default: "body-sm-medium gap-6",
      filled: "body-xs-medium gap-1",
      filled_secondary: "body-xs-medium gap-2 bg-tab-group-bg rounded p-1",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {}
export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(TabsContext);
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(TabListVariants({ variant }), className)}
      {...props}
    />
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabTriggerVariants = cva(["BB-TabTrigger transition"], {
  variants: {
    variant: {
      default: [
        "border-transparent border-b",
        "disabled:pointer-events-none disabled:opacity-50", // TODO: fix with colors
        "text-ds-text-body",
        "hover:text-general-label-hover",
        "radix-state-active:border-current radix-state-active:text-tab-action-active",
        "[&.active]:border-current [&.active]:text-tab-action-active",
      ],
      filled: [
        "text-nowrap rounded-t-sm px-2.5",
        "disabled:pointer-events-none disabled:opacity-50", // TODO: fix with colors
        "bg-tab-bg-secondary text-ds-text-caption",
        "hover:text-general-label",
        "radix-state-active:bg-tab-filled-primary-bg-active radix-state-active:text-tab-filled-primary-text-active",
        "[&.active]:bg-tab-filled-primary-bg-active [&.active]:text-tab-filled-primary-text-active",
      ],
      filled_secondary: [
        "whitespace-nowrap rounded truncate",
        "px-2.5 py-[7px]",
        "w-full",
        "radix-state-active:font-medium",
        "text-tab-filled-secondary-text",
        "radix-state-active:text-tab-action-active radix-state-active:bg-tab-bg-primary",
        "hover:radix-state-inactive:bg-tab-filled-secondary-bg-hover",
      ],
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {}
export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(TabsContext);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(TabTriggerVariants({ variant }), className)}
      {...props}
    />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export interface TabsContentProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> {}
export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={className} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;
