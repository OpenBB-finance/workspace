import { memo, useMemo } from "react";
import { TabWidgetElement } from "~/components/AI/hooks/useCopilotAddToContext";
import { useShallowAppWidgetsStore } from "~/components/AI/hooks/useGetAppWidgets";
import { cn } from "~/components/ds/utils/cn";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";
import Tooltip from "~/components/Tooltip";
import type { WidgetId } from "~/components/Widgets";
import type { CopilotWidget } from "~/lib/state/copilot";

interface WidgetTooltipItemProps {
  /** The actual widget name — used in the tooltip detail panel */
  name: string;
  /** Display name shown in the row (e.g. with count suffix). Defaults to `name`. */
  displayName?: string;
  description?: string | null;
  /** Backend/source label shown in the tooltip badge (e.g. "Exponential Technology") */
  origin?: string;
  /** Widget ID used to look up the full widget definition for richer tooltip metadata */
  widgetId?: string;
}

interface WidgetNameItemProps {
  name: string;
  description?: string | null;
  icon?: IconId;
  iconClassName?: string;
}

/**
 * Displays a widget row: optional icon + bold name + muted truncated description.
 * Used in the @ context dropdown suggestions and in App Card widget hover lists.
 */
export const WidgetNameItem = memo<WidgetNameItemProps>(
  ({ name, description, icon, iconClassName }) => {
    return (
      <div className="flex items-center gap-2 min-w-0 w-full">
        {icon && (
          <Icon
            id={icon}
            className={cn("flex-none h-[14px] w-[14px]", iconClassName)}
          />
        )}
        <div className="flex items-baseline gap-x-2 min-w-0 flex-1">
          <span
            className={cn(
              "text-ds-text-heading text-xs font-medium truncate",
              description ? "max-w-[75%]" : "max-w-full",
            )}
          >
            {name}
          </span>
          {description && (
            <span className="text-ds-text-body text-[11px] truncate flex-1 min-w-0">
              {description}
            </span>
          )}
        </div>
      </div>
    );
  },
);

/**
 * Renders a `WidgetNameItem` row (icon + bold name + muted description) wrapped in a
 * hover `Tooltip` showing the full `TabWidgetElement` detail panel (backend tag, name,
 * category, description). Used in AppCard widget lists and the Marketplace modal.
 */
export const WidgetTooltipItem = memo<WidgetTooltipItemProps>((props) => {
  const { name, displayName, description, origin, widgetId } = props;

  const widgetDef = useShallowAppWidgetsStore((s) =>
    widgetId ? s.getAppWidget(widgetId as WidgetId, origin) : undefined,
  );

  const message = useMemo(() => {
    const copilotWidget = {
      widget_id: widgetId,
      origin,
      name,
      description: description || "",
      params: [],
      metadata: {},
    } as CopilotWidget;

    return <TabWidgetElement tabWidget={copilotWidget} widgetDefinition={widgetDef} />;
  }, [widgetId, origin, name, description, widgetDef]);

  return (
    <Tooltip
      message={message}
      position="right"
      sideOffset={8}
      className="p-3 max-w-[300px]"
    >
      <div>
        <WidgetNameItem name={displayName ?? name} />
      </div>
    </Tooltip>
  );
});
