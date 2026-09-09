import { Reorder, useDragControls } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { Button } from "./ds/atoms/Button";
import { Switch } from "./ds/atoms/Switch";
import { BaseDialog } from "./ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "./ds/dialogs/Dialog";
import { cn } from "./ds/utils/cn";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import type { ParamDef } from "./types";
import { useWidgetContext } from "./Widget.context";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface ParamVisibility {
  paramName: string;
  show: boolean;
  hidden: boolean;
  label: string;
}

export function ParametersDialog(props: Props) {
  const { open, setOpen } = props;
  const { widget, widgetFromJSON, updateWidget } = useWidgetContext();

  // Get params from widget or widgetFromJSON
  const params = useMemo(() => {
    return widget?.params ?? widgetFromJSON?.params ?? [];
  }, [widget?.params, widgetFromJSON?.params]);

  // Initialize temporary state from current params
  const initialVisibility = useMemo(() => {
    return params.map((param) => ({
      paramName: param.paramName,
      show: param.show ?? true, // Default to true if not specified
      hidden: param.hidden ?? false, // Default to false if not specified
      label: param.label || param.paramName,
    }));
  }, [params]);

  const [paramVisibility, setParamVisibility] =
    useState<ParamVisibility[]>(initialVisibility);

  // Reset state when dialog opens or params change
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        // Reset to current state when opening
        setParamVisibility(initialVisibility);
      }
      setOpen(newOpen);
    },
    [initialVisibility, setOpen],
  );

  // Handle toggle for a specific parameter
  const handleToggle = useCallback((paramName: string, checked: boolean) => {
    setParamVisibility((prev) =>
      prev.map((p) =>
        p.paramName === paramName ? { ...p, show: checked, hidden: !checked } : p,
      ),
    );
  }, []);

  // Handle reorder
  const handleReorder = useCallback((newOrder: ParamVisibility[]) => {
    setParamVisibility(newOrder);
  }, []);

  // Save changes to widget
  const handleSave = useCallback(() => {
    // Create updated params array in the new order
    const updatedParams: ParamDef[] = paramVisibility
      .map((pv) => {
        const originalParam = params.find((p) => p.paramName === pv.paramName);
        if (!originalParam) return null;

        return {
          ...originalParam,
          show: pv.show,
          hidden: pv.hidden,
        };
      })
      .filter(Boolean) as ParamDef[];

    // Update the widget with new params (with new order and visibility)
    updateWidget(
      (prev) => ({
        ...prev,
        params: updatedParams,
      }),
      true,
    );

    setOpen(false);
  }, [params, paramVisibility, updateWidget, setOpen]);

  if (!widget || params.length === 0) return null;

  const useTwoColumns = params.length >= 10;

  return (
    <BaseDialog
      open={open}
      onClose={() => handleOpenChange(false)}
      focusOnOpen={false}
      className={useTwoColumns ? "sm:max-w-2xl" : undefined}
    >
      <DialogTitle>Parameters</DialogTitle>
      <div className="flex flex-col gap-3 flex-1 min-h-0 body-xs-regular">
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <div className="flex justify-between items-center mb-2">
            <span className="text-light-500 dark:text-dark-50 body-xs-regular text-[8px] uppercase tracking-widest">
              PARAMETER
            </span>
            <span className="text-light-500 dark:text-dark-50 body-xs-regular text-[8px] uppercase tracking-widest">
              VISIBILITY
            </span>
          </div>
          <Reorder.Group
            axis="y"
            values={paramVisibility}
            onReorder={handleReorder}
            className={cn(
              "grid gap-2 overflow-y-auto pr-1",
              useTwoColumns ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
            )}
          >
            {paramVisibility.map((param) => (
              <ParameterRow
                key={param.paramName}
                param={param}
                onToggle={handleToggle}
              />
            ))}
          </Reorder.Group>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outlined" size="sm" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave}>
          Save
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}

function ParameterRow({
  param,
  onToggle,
}: {
  param: ParamVisibility;
  onToggle: (paramName: string, checked: boolean) => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={param}
      id={param.paramName}
      dragControls={controls}
      dragListener={false}
      className="touch-none"
      layout="position"
    >
      <div className="flex justify-between items-center p-2.5 dark:bg-dark-800 rounded bg-light-50">
        <div className="flex items-center gap-2">
          <Tooltip message="Drag to reorder">
            <button
              tabIndex={-1}
              className="obb-small-navbar-btn flex-shrink-0"
              onPointerDown={(e) => controls.start(e)}
            >
              <Icon id="drag-handle" />
            </button>
          </Tooltip>
          <span>{param.label}</span>
        </div>
        <Switch
          checked={param.show}
          onCheckedChange={(checked) => onToggle(param.paramName, checked)}
        />
      </div>
    </Reorder.Item>
  );
}
