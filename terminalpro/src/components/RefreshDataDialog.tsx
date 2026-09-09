import { useCallback, useEffect, useState } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import { Switch } from "~/components/ds/atoms/Switch";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "~/components/ds/dialogs/Dialog";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";

export interface RefreshDataSettings {
  refreshEnabled: boolean;
  refreshRate: number;
}

const DEFAULT_SETTINGS: RefreshDataSettings = {
  refreshEnabled: false,
  refreshRate: 30,
};

const MIN_REFRESH_RATE = 10;

interface RefreshDataDialogProps {
  open: boolean;
  onClose: () => void;
}

export function RefreshDataDialog({ open, onClose }: RefreshDataDialogProps) {
  const { widget, updateWidget } = useWidgetContext();

  const initialSettings = widget.storage?.refreshData ?? DEFAULT_SETTINGS;

  const [refreshEnabled, setRefreshEnabled] = useState(initialSettings.refreshEnabled);
  const [refreshRate, setRefreshRate] = useState(initialSettings.refreshRate);

  useEffect(() => {
    if (open) {
      const settings = widget.storage?.refreshData ?? DEFAULT_SETTINGS;
      setRefreshEnabled(settings.refreshEnabled);
      setRefreshRate(settings.refreshRate);
    }
  }, [open, widget.storage?.refreshData]);

  const handleSave = useCallback(() => {
    const clampedRefreshRate = Math.max(refreshRate, MIN_REFRESH_RATE);

    updateWidget((prev) => ({
      ...prev,
      storage: {
        ...prev.storage,
        refreshData: {
          refreshEnabled,
          refreshRate: clampedRefreshRate,
        },
      },
    }));
    onClose();
  }, [refreshEnabled, refreshRate, updateWidget, onClose]);

  const handleRefreshRateChange = useCallback((value: string | number) => {
    const numValue = typeof value === "string" ? Number.parseInt(value, 10) : value;
    if (!Number.isNaN(numValue) && numValue >= 0) {
      setRefreshRate(numValue);
    }
  }, []);

  return (
    <BaseDialog open={open} onClose={onClose} className="max-w-sm">
      <DialogTitle>Refresh Data</DialogTitle>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <Switch
            checked={refreshEnabled}
            onCheckedChange={setRefreshEnabled}
            label={
              <span className="inline-flex items-center gap-1.5">
                Auto refresh
                <span onClick={(e) => e.preventDefault()}>
                  <Tooltip
                    message="Automatically re-fetch data at the specified interval. Useful for keeping data up-to-date without manual refresh."
                    className="max-w-[200px]"
                  >
                    <span className="inline-flex cursor-help">
                      <Icon
                        id="info-circle"
                        className="size-3.5 text-ds-text-caption"
                      />
                    </span>
                  </Tooltip>
                </span>
              </span>
            }
          />
          <div className="pl-1">
            <Input
              label="Refresh interval (seconds)"
              type="number"
              size="sm"
              value={refreshRate}
              onChange={handleRefreshRateChange}
              min={MIN_REFRESH_RATE}
              disabled={!refreshEnabled}
              message={
                refreshEnabled && refreshRate < MIN_REFRESH_RATE
                  ? `Minimum is ${MIN_REFRESH_RATE} seconds`
                  : undefined
              }
              error={refreshEnabled && refreshRate < MIN_REFRESH_RATE}
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outlined" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave}>
          Save
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}
