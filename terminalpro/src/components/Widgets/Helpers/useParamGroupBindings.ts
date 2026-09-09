import { useCallback, useMemo } from "react";
import type { Group, GroupTypeT, ParamDef } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowSharedAppStore } from "~/lib/state/sharedApp";
import { getEndpointParamName } from "~/lib/utils";

export type ParamGroupBinding = [string, GroupTypeT<"endpointParam" | "param">];

/** Stable empty reference so the store selector does not thrash shallow equality. */
const EMPTY_GROUPS: Group[] = [];

/**
 * Resolves the widget param name that a group writes to.
 *
 * Endpoint-param groups key off `groupById` (a stable id) which we map back to
 * the live param name via the widget's param defs; plain `param` groups already
 * store the param name in `groupById`. Returns undefined for ticker groups since
 * they are not bound to a single widget param.
 */
export function getGroupParamName(
  group: Group,
  paramDefs: ParamDef[],
): string | undefined {
  if (group.type === "endpointParam") {
    return getEndpointParamName(paramDefs, group.groupById) ?? group.groupById;
  }
  if (group.type === "param") {
    return group.groupById;
  }
  return undefined;
}

/**
 * Builds the `[paramName, group]` bindings between a widget's params and the
 * dashboard groups that drive them, and returns writers that push param changes
 * back into those groups. Reads from the shared or local app store based on the
 * widget context's `isShared` flag.
 *
 * Bindings are deduped by group id (not param name) so the rare case of two
 * distinct groups bound to the same param name still yields both — they should
 * each receive updates.
 */
export function useParamGroupBindings(params?: {
  includeDashboardGroups?: boolean;
  endpointParamsOnly?: boolean;
  filterAllowedParams?: boolean;
}) {
  const {
    includeDashboardGroups = false,
    endpointParamsOnly = false,
    filterAllowedParams = false,
  } = params ?? {};

  const { widgetFromJSON, activeDashboardId, isShared } = useWidgetContext();
  const getDashboardById = useShallowSharedAppStore((s) => s.getDashboardById);

  const { activeWidgetGroups, activeDashboardGroups, updateGroup } = useShallowAppStore(
    (s) => {
      const getTabById = isShared ? getDashboardById : s.getTabById;
      const dashboardGroups = includeDashboardGroups
        ? getTabById(activeDashboardId)?.data?.groups
        : undefined;

      return {
        activeWidgetGroups: s.getWidgetGroups(activeDashboardId, widgetFromJSON?.id),
        activeDashboardGroups: dashboardGroups ?? EMPTY_GROUPS,
        updateGroup: s.updateGroup,
      };
    },
  );

  const allowedParams = useMemo(() => {
    if (!widgetFromJSON?.params) return undefined;
    return new Set(
      widgetFromJSON.params
        .filter((p) => (endpointParamsOnly ? p.type === "endpoint" : true))
        .map((p) => p.paramName)
        .filter(Boolean),
    );
  }, [widgetFromJSON?.params, endpointParamsOnly]);

  const bindings = useMemo<ParamGroupBinding[]>(() => {
    const result: ParamGroupBinding[] = [];
    const seenGroupIds = new Set<string>();

    const addGroupBinding = (group: Group) => {
      if (group.type !== "endpointParam" && group.type !== "param") return;
      if (seenGroupIds.has(group.id)) return;

      const paramName = getGroupParamName(group, widgetFromJSON?.params ?? []);
      if (!paramName) return;
      if (filterAllowedParams && allowedParams && !allowedParams.has(paramName)) return;

      seenGroupIds.add(group.id);
      result.push([paramName, group]);
    };

    for (const group of activeWidgetGroups) addGroupBinding(group);
    for (const group of activeDashboardGroups) addGroupBinding(group);

    return result;
  }, [
    activeWidgetGroups,
    activeDashboardGroups,
    widgetFromJSON?.params,
    allowedParams,
    filterAllowedParams,
  ]);

  /** Writes a single param value into its bound group. Returns whether a group matched. */
  const updateGroupedParam = useCallback(
    (paramName: string, value: string | string[]) => {
      const group = bindings.find(([name]) => name === paramName)?.[1];
      if (!group?.id) return false;

      updateGroup(activeDashboardId, group.id, { ...group, value } as Group);
      return true;
    },
    [activeDashboardId, bindings, updateGroup],
  );

  /** Writes each provided param value into its bound group, skipping unchanged values. */
  const updateGroupedParams = useCallback(
    (params: Record<string, string | string[]>) => {
      for (const [paramName, group] of bindings) {
        if (!Object.prototype.hasOwnProperty.call(params, paramName)) continue;

        const value = params[paramName];
        if (group.value === value) continue;

        updateGroup(activeDashboardId, group.id, { ...group, value } as Group);
      }
    },
    [activeDashboardId, bindings, updateGroup],
  );

  return useMemo(
    () => ({ bindings, updateGroupedParam, updateGroupedParams }),
    [bindings, updateGroupedParam, updateGroupedParams],
  );
}
