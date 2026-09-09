import { useCallback, useState } from "react";
import { Button } from "~/components/ds/atoms/Button";
import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "~/components/ds/atoms/Popover";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import type { OpenBBWidgetManifest } from "~/types/iframeProtocol";

interface IframeWidgetsPopoverProps {
  manifest: OpenBBWidgetManifest[];
  onExport: (widgetId: string) => Promise<void>;
}

export function IframeWidgetsPopover({
  manifest,
  onExport,
}: IframeWidgetsPopoverProps) {
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const handleExport = useCallback(
    async (widgetId: string) => {
      setLoadingIds((prev) => new Set(prev).add(widgetId));
      try {
        await onExport(widgetId);
      } finally {
        setLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(widgetId);
          return next;
        });
      }
    },
    [onExport],
  );

  return (
    <PopoverRoot>
      <PopoverTrigger asChild>
        <div>
          <Tooltip message="Available widgets inside this iframe">
            <Button
              type="button"
              className="flex gap-1 items-center w-fit px-1.5"
              size="xs"
              variant="secondary"
              data-testid="iframe-widgets-popover-trigger"
            >
              <Icon id="grid-01" className="min-w-4 w-4 h-4" />
              <span className="text-xs tabular-nums">{manifest.length}</span>
            </Button>
          </Tooltip>
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={4}
        className="w-72 p-2.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between pb-2 border-b border-light-200 dark:border-dark-500">
            <span className="font-semibold text-sm text-light-900 dark:text-light-200">
              Available Widgets
            </span>
            <span className="text-2xs text-ds-text-caption">
              {manifest.length} {manifest.length === 1 ? "widget" : "widgets"}
            </span>
          </div>
        </div>

        <div className="overflow-y-auto max-h-48 mt-2">
          <div className="space-y-0.5">
            {manifest.map((w) => (
              <Tooltip
                key={w.widgetId}
                position="left"
                align="start"
                className="max-h-[320px] max-w-[280px]"
                message={
                  w.description ? (
                    <div className="max-w-md">
                      <div className="font-semibold text-black dark:text-white mb-1 text-sm">
                        {w.name}
                      </div>
                      <p className="text-xs text-ds-text-caption">{w.description}</p>
                    </div>
                  ) : (
                    <span className="font-semibold text-black dark:text-white">
                      {w.name}
                    </span>
                  )
                }
              >
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm
                    hover:bg-light-50 dark:hover:bg-dark-600 cursor-pointer"
                  onClick={() => handleExport(w.widgetId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleExport(w.widgetId);
                  }}
                  role="button"
                  tabIndex={0}
                  data-testid={`iframe-widget-export-${w.widgetId}`}
                >
                  {loadingIds.has(w.widgetId) ? (
                    <Icon
                      id="mdi-loading"
                      className="w-3.5 h-3.5 animate-spin flex-shrink-0"
                    />
                  ) : (
                    <Icon id="plus" className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <span className="text-xs text-light-500 dark:text-dark-50 truncate">
                    {w.name}
                  </span>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
