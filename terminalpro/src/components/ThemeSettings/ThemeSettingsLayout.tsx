import type React from "react";
import { useCallback, useState } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { Tabs, TabsList, TabsTrigger } from "~/components/ds/molecules/Tabs";

interface ThemeSettingsLayoutProps {
  children: React.ReactNode;
  preview: React.ReactNode;
  onSave: () => Promise<void>;
  onReset: () => void;
  selectedThemeMode?: "light" | "dark";
  onThemeModeChange?: (mode: "light" | "dark") => void;
}

export const THEME_MODES = ["light", "dark"] as const;

export function ThemeSettingsLayout({
  children,
  preview,
  onSave,
  onReset,
  selectedThemeMode = "light",
  onThemeModeChange,
}: ThemeSettingsLayoutProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    try {
      await onSave();
    } catch (error) {
      console.error("Error saving theme:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onSave]);

  return (
    <div className="grid grid-cols-10 space-x-2 h-[calc(100vh-170px)] min-h-0">
      <div className="flex flex-col items-start gap-4 col-span-3 bg-general-bg-primary p-4 rounded h-full overflow-y-auto">
        {onThemeModeChange && (
          <Tabs
            value={selectedThemeMode}
            onValueChange={onThemeModeChange}
            variant="filled_secondary"
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="light" className="text-xs">
                Light Mode
              </TabsTrigger>
              <TabsTrigger value="dark" className="text-xs">
                Dark Mode
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {children}
      </div>

      <div className="flex flex-col gap-4 col-span-7 h-full min-h-0">
        <div className="flex-1 min-h-0 bg-general-bg-primary p-4 rounded flex flex-col gap-4">
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">{preview}</div>
          <div className="flex flex-row gap-2 w-fit">
            <Button
              onClick={handleSave}
              className="w-full whitespace-nowrap"
              size="sm"
              disabled={isLoading}
              loading={isLoading}
            >
              Save Theme
            </Button>
            <Button
              onClick={onReset}
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={isLoading}
            >
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
