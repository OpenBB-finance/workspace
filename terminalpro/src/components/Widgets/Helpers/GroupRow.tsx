import { type MouseEvent as ReactMouseEvent, type ReactNode, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { Popover } from "~/components/ds/atoms/Popover";
import { Tag } from "~/components/ds/atoms/Tag";
import { cn } from "~/components/ds/utils";
import Icon from "~/components/Icon";
import Tooltip from "~/components/SpecialTooltip";

interface GroupRowProps {
  name: string;
  color: string;
  /** Value shown in the trailing pill (e.g. ticker symbol or group type). */
  valueLabel?: ReactNode;
  /** Optional tooltip for the value pill when it can overflow. */
  valueTooltip?: ReactNode;
  /** When true, renders a leading checkbox and makes the row clickable. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (e: ReactMouseEvent) => void;
  /** When provided, the color swatch opens a picker; otherwise it is static. */
  onColorChange?: (color: string) => void;
  onDelete: () => void;
  disabled?: boolean;
  className?: string;
}

function ColorSwatch({
  color,
  onColorChange,
}: {
  color: string;
  onColorChange?: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const swatchClass = "size-3.5 shrink-0 rounded-[3px]";

  if (!onColorChange)
    return <span className={swatchClass} style={{ backgroundColor: color }} />;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      sideOffset={4}
      className="w-auto p-2"
      content={
        // Portaled content bubbles through the React tree, so stop clicks here
        // to avoid toggling the row's selection handler.
        <div
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <HexColorPicker
            color={color}
            onChange={onColorChange}
            className="!w-[180px] !h-[140px]"
          />
        </div>
      }
    >
      <button
        type="button"
        aria-label="Change group color"
        className={cn(swatchClass, "cursor-pointer group-dropdown")}
        style={{ backgroundColor: color }}
        onClick={(e) => e.stopPropagation()}
      />
    </Popover>
  );
}

export function GroupPanelHeader({ onCreate }: { onCreate?: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 group-dropdown">
        <span className="body-sm-medium text-ds-text-heading group-dropdown">
          Groups
        </span>
        {onCreate ? (
          <Tooltip message="Create a group">
            <button
              type="button"
              aria-label="Create a group"
              onClick={onCreate}
              className="group-dropdown shrink-0 rounded p-0.5 text-ds-text-body hover:text-ds-text-heading"
            >
              <Icon id="plus" className="size-4 group-dropdown" />
            </button>
          </Tooltip>
        ) : null}
      </div>
      <hr className="obb-divider my-0 group-dropdown" />
    </>
  );
}

export function GroupRow({
  name,
  color,
  valueLabel,
  valueTooltip,
  selectable,
  selected,
  onToggleSelect,
  onColorChange,
  onDelete,
  disabled,
  className,
}: GroupRowProps) {
  const pill = valueLabel ? (
    <Tag className="max-w-[110px] truncate">{valueLabel}</Tag>
  ) : null;

  return (
    <div
      className={cn(
        "group group-dropdown flex items-center justify-between gap-2",
        disabled && "opacity-50",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 group-dropdown",
          selectable && "cursor-pointer",
        )}
        onClick={selectable ? onToggleSelect : undefined}
      >
        {selectable ? (
          <Checkbox
            className="group-dropdown"
            checked={selected}
            data-testid="group-row-checkbox"
          />
        ) : null}
        <span className="body-xs-medium whitespace-nowrap text-ds-text-heading">
          {name}:
        </span>
        <ColorSwatch color={color} onColorChange={onColorChange} />
        {valueTooltip ? (
          <Tooltip className="max-w-64" message={valueTooltip}>
            {pill}
          </Tooltip>
        ) : (
          pill
        )}
      </div>
      <Tooltip message="Delete group">
        <button
          type="button"
          aria-label="Delete group"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={cn(
            "group-dropdown shrink-0 rounded p-0.5 opacity-0 transition-opacity",
            "text-ds-text-body",
            "group-hover:opacity-100 focus-visible:opacity-100",
          )}
        >
          <Icon id="trash-04" className="size-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}
