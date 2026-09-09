import { toast } from "sonner";
import { v4 as uuid } from "uuid";
import type { WidgetJsonT, WidgetT } from "~/components/types";
import { generateRandomName } from "~/lib/utils";
import type { WidgetType } from "~/utils/zodForms";
import { useAppStore } from "../state/app";

/**
 * Handles the addition of a connection to a dashboard.
 * @param dashboardId - The id of the dashboard to add the connection to. May be undefined if the user is outside the dashboard.
 * @param widgets - The widgets to add to the dashboard.
 * @param navigate - The navigate function to use to navigate to a new dashboard.
 */
export function handleConnectionAdded<
  T extends WidgetT | WidgetType | WidgetJsonT = WidgetT,
>(dashboardId: string, widgets: T[], navigate: (path: string) => void, isEdit = false) {
  const widgetCount = widgets.length;

  let description = `The widget${widgetCount > 1 ? "s have" : " has"} been added to the widget menu (accessible via Ctrl + K).`;
  let successMessage = `${widgetCount} widget${widgetCount > 1 ? "s" : ""} added to widget menu`;

  if (isEdit) {
    description = `The widget${widgetCount > 1 ? "s have" : " has"} been updated on the widget menu (accessible via Ctrl + K).`;
    successMessage = `${widgetCount} widget${widgetCount > 1 ? "s" : ""} updated on the widget menu`;
  }

  if (widgetCount > 10) {
    // Notify the user without adding widgets or providing the "Add to new dashboard" option
    toast.success(`${widgetCount} widgets added to widget menu`, {
      description,
    });
    return; // Exit the function early
  }
  if (dashboardId) {
    // User is inside a dashboard
    useAppStore.getState().addWidgets(dashboardId, widgets as WidgetT[]);
    toast.success(
      `${widgetCount} widget${widgetCount > 1 ? "s" : ""} added to dashboard`,
      {
        description: `The widget${widgetCount > 1 ? "s have" : " has"} been added to the current dashboard.`,
      },
    );
  } else {
    // User is outside dashboard
    toast.success(successMessage, {
      className: "_toast-success",
      description,
      action: {
        label: "Add to new dashboard",
        onClick: () => {
          const newDashboardId = uuid();
          useAppStore.getState().addTab({
            index: newDashboardId,
            data: {
              name: generateRandomName(),
              type: "custom",
              widgets: widgets as WidgetT[],
            },
          });
          navigate(`/app/${newDashboardId}`);
        },
      },
    });
  }
}
