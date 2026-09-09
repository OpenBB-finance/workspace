import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "~/lib/utils";

interface Tab {
  label: string;
  id: string;
  disabled?: boolean;
  suffix?: ReactNode;
}

interface SettingsLayoutProps {
  title: string;
  description?: ReactNode;
  tabs: Tab[];
  children: ReactNode;
  defaultTab?: string;
}

export const SettingsLayout = ({
  title,
  description,
  tabs,
  children,
  defaultTab,
}: SettingsLayoutProps) => {
  const [params, setSearchParams] = useSearchParams();
  const activeTab = params.get("tab") || defaultTab || (tabs[0]?.id ?? "");

  return (
    <div className="min-h-screen bg-surface-page">
      <TabsPrimitive.Root
        value={activeTab}
        onValueChange={(value) =>
          setSearchParams((prev) => {
            prev.set("tab", value);
            prev.delete("app");
            return prev;
          })
        }
      >
        <div className="bg-general-bg-primary border-b border-general-border-secondary">
          <div
            className={cn("text-base pt-6 px-6 font-bold text-ds-text-heading", {
              "pb-6": tabs.length === 0 && !description,
              "mb-4": tabs.length > 0,
            })}
          >
            {title}
          </div>
          {description && (
            <div
              className={cn("px-6 text-xs text-ds-text-body mt-1", {
                "pb-6": tabs.length === 0,
                "mb-4": tabs.length > 0,
              })}
            >
              {description}
            </div>
          )}
          {tabs.length > 0 && (
            <TabsPrimitive.List className="flex pl-6 gap-4 text-sm">
              {tabs.map((tab) => (
                <TabsPrimitive.Trigger
                  key={tab.label}
                  value={tab.id}
                  disabled={tab.disabled}
                  className={cn(
                    "pb-2 flex items-center gap-1.5",
                    "border-b-2 border-transparent",
                    "radix-state-active:border-brand-main radix-state-active:text-brand-main",
                    "dark:radix-state-active:border-brand-lighter dark:radix-state-active:text-brand-lighter",
                    "radix-state-inactive:text-ds-text-body hover:radix-state-inactive:text-ds-text-heading",
                    tab.disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {tab.label}
                  {tab.suffix}
                </TabsPrimitive.Trigger>
              ))}
            </TabsPrimitive.List>
          )}
        </div>
        {children}
      </TabsPrimitive.Root>
    </div>
  );
};
