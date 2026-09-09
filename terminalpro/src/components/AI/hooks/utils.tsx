import isEqual from "lodash.isequal";
import { toast } from "sonner";
import type { WidgetT } from "~/components/types";
import type { Copilot, CopilotFile, WidgetSignature } from "~/lib/state/copilot";
import type { DashboardWidgetData } from "~/lib/state/copilotData";
import { currentDateModifier } from "~/lib/utils/widgetParams";
import type { CreateWidgetParams } from "./useCreateWidgetFromArtifact";
import type { CopilotSubmitParams } from "./useStreamResponse";

/**
 * Dispatches an event update Copilot question
 */
export async function dispatchCopilotCommand(
  command: string | ((prev: string) => string),
) {
  return window.dispatchEvent(
    new CustomEvent("copilotCommand", {
      detail: { command },
    }),
  );
}

/**
 * Uploaded files travel with the message they were attached to, failed ones stay
 * in the composer so the user can see the error, and a pending upload blocks the send.
 */
export function partitionFilesOnSend(files: CopilotFile[]) {
  const sent: CopilotFile[] = [];
  let hasPending = false;

  for (const file of files) {
    if (file.status === "uploaded") sent.push(file);
    else if (file.status === "pending") hasPending = true;
  }

  return { sent, hasPending };
}

export function dispatchCreate(detail: CreateWidgetParams) {
  return window.dispatchEvent(
    new CustomEvent("createWidgetPopup", {
      detail,
    }),
  );
}

export function getWidgetOrigin(widget: WidgetT): string {
  // TODO: We should have an explicit field for this

  if (widget.connectionType === "file") return "OpenBB Hub";
  if (widget.widgetId?.includes("widget_studio")) return "Widget Studio";

  if (widget.external) return widget.sourceName ?? "Unknown";

  if (
    widget.widgetId?.includes("iframe") ||
    widget.widgetId?.includes("rss_viewer") ||
    widget.widgetId?.includes("rich_note") ||
    widget.widgetId?.includes("copilot_table") ||
    widget.widgetId?.includes("markdown") ||
    widget.widgetId?.includes("file_viewer")
    // TODO: Temporary fix for charting widget
    // widget.widgetId === "charting"
  ) {
    return "OpenBB Workspace";
  }
  return "OpenBB Sandbox";
}

export const showDeprecatedFlagsToast = (copilot: Copilot, outdatedFlags: any[]) => {
  toast.warning("Outdated copilots.json or agents.json detected", {
    description: (
      <>
        Deprecated config flags detected for '{copilot.name}':{" "}
        {outdatedFlags.join(", ")}. Check the{" "}
        <a
          href="https://github.com/OpenBB-finance/copilot-for-openbb/blob/main/README.md#configuring-your-custom-copilot-for-the-openbb-workspace-copilotsjson"
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-primary-500 hover:text-primary-600"
        >
          documentation
        </a>{" "}
        for the latest schema.
      </>
    ),
  });
};

export function dispatchExpandCopilotIfHidden() {
  return window.dispatchEvent(new CustomEvent("expandCopilotIfHidden"));
}

export function dispatchCollapseCopilotPanel() {
  return window.dispatchEvent(new CustomEvent("collapseCopilot"));
}

export async function dispatchCopilotSubmit(props?: CopilotSubmitParams) {
  const { question, addHumanMessage, mockResponse } = props || {};

  return window.dispatchEvent(
    new CustomEvent("copilotSubmit", {
      detail: { question, addHumanMessage, mockResponse },
    }),
  );
}

export function normalizeWidgetId(
  widgetId: string | undefined,
  origin?: string,
): string {
  return widgetId?.replace(`${origin}-`, "");
}

// Helper function to normalize argument values for comparison
function normalizeArgValue(value: any, _key: string): any {
  // Convert single-element arrays to their first element for comparison
  // This handles the case where backend sends ["UNRATE"] but widget has "UNRATE"
  if (Array.isArray(value) && value.length === 1) {
    value = value[0];
  }

  // Normalize string numbers to numbers for comparison
  // This handles cases where one source has "20" and another has 20
  if (typeof value === "string" && !Number.isNaN(Number(value)) && value !== "") {
    // Check if it's a pure number (not something like "20abc")
    const numValue = Number(value);
    if (numValue.toString() === value.trim()) {
      return numValue;
    }
  }

  return value;
}

// Compare args with normalization
function compareNormalizedArgs(args1: any, args2: any): boolean {
  if (!(args1 || args2)) return true;
  if (!(args1 && args2)) return false;

  // Only compare keys that exist in args2 (the citation signature)
  // This means we only check if the citation's specified params match
  // We don't care about extra params in the widget that aren't in the citation
  for (const key of Object.keys(args2)) {
    const val1 = normalizeArgValue(args1[key], key);
    const val2 = normalizeArgValue(args2[key], key);

    // If widget doesn't have this param but citation specifies it, no match
    if (val1 === undefined || val1 === null) {
      if (val2 !== undefined && val2 !== null) {
        return false;
      }
      continue;
    }

    if (!isEqual(val1, val2)) {
      return false;
    }
  }

  return true;
}

export function compareSignatures(
  sig1: WidgetSignature | undefined,
  sig2: WidgetSignature | undefined,
): boolean {
  if (!(sig1 && sig2)) return false;

  const normalizedWidgetId1 = normalizeWidgetId(sig1.widgetId, sig1.origin);
  const normalizedWidgetId2 = normalizeWidgetId(sig2.widgetId, sig2.origin);
  const originMatch = sig1.origin === sig2.origin;
  const widgetIdMatch = normalizedWidgetId1 === normalizedWidgetId2;
  const argsMatch = compareNormalizedArgs(sig1.args, sig2.args);

  return originMatch && widgetIdMatch && argsMatch;
}

export function createSignatureMap(
  widgetsInCurrentDashboard: WidgetT[],
  dashboardWidgetsData: Record<string, DashboardWidgetData>,
) {
  return widgetsInCurrentDashboard.reduce(
    (acc, widget) => {
      const widgetParams = dashboardWidgetsData?.[widget.id]?.metadata?.params ?? {};
      const currentParams = (widget.params ?? []).reduce((paramAcc, param) => {
        // Check for params in multiple places:
        // 1. dashboardWidgetsData (when widget has been used with AI)
        // 2. widget.storage.params (actual stored params)
        // 3. param.value (default value)
        const paramValue =
          widgetParams?.[param.paramName] ??
          widget.storage?.params?.[param.paramName] ??
          param.value;
        paramAcc[param.paramName] =
          param.type === "date" ? currentDateModifier(paramValue) : paramValue;
        return paramAcc;
      }, {});

      const origin = getWidgetOrigin(widget);
      const normalizedWidgetId = normalizeWidgetId(widget.widgetId, origin);
      acc[widget.id] = {
        origin: origin,
        widgetId:
          (origin === "OpenBB Workspace" ? widget.id : normalizedWidgetId) ?? "Unknown",
        args: currentParams,
        // ssmRequest:
        //   widget.type === "ssrm_table" ? widget.storage?.ssmRequest : undefined,
      };
      return acc;
    },
    {} as Record<string, WidgetSignature>,
  );
}

/** Returns true when a citation carries a SQL query that differs from the matched widget's query. */
export function detectQueryMismatch(
  citationQuery: string | undefined,
  widgetQuery: string | undefined,
): boolean {
  return !!(citationQuery && widgetQuery && citationQuery !== widgetQuery);
}
