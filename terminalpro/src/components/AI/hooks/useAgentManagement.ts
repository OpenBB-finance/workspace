import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import {
  fetchAgentsData,
  hasCopilotConflict,
  putCustomCopilot,
  removeCustomCopilot,
} from "~/api/auth.api";
import { useStateReducer } from "~/hooks/useStateReducer";
import { getDefaultCopilot } from "~/lib/constants";
import {
  type ExternalCopilotHolder,
  useCopilotStore,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import { useShallowThemeStore } from "~/lib/state/theme";
import { createURLString } from "~/lib/utils/widgetParams";

export type HolderGroup = ExternalCopilotHolder & {
  changed?: boolean;
  originalUrl?: string;
};

function normalizeHolder(holder: ExternalCopilotHolder): HolderGroup {
  return {
    ...holder,
    enabled: holder.enabled !== false,
  };
}

export type AgentManagementState = {
  groups: HolderGroup[];
  groupToDelete: string | null;
  isRefreshing: boolean;
  editGroup: {
    uuid: string;
    url: string;
    headerPairs: { key: string; value: string }[];
  } | null;
};

export function useAgentManagement() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounceValue(search, 300);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { externalCopilotHolders, selectedCopilot, setSelectedCopilot } =
    useShallowCopilotStore((copilot) => ({
      externalCopilotHolders: copilot.externalCopilotHolders,
      selectedCopilot: copilot.selectedCopilot,
      setSelectedCopilot: copilot.setSelectedCopilot,
    }));

  const { setShowAddAgentsDialog } = useShallowThemeStore((state) => ({
    setShowAddAgentsDialog: state.setShowAddAgentsDialog,
  }));

  const [state, dispatch] = useStateReducer<AgentManagementState>({
    groups: [],
    groupToDelete: null,
    isRefreshing: false,
    editGroup: null,
  });

  /**
   * Syncs local `groups` state with the global `externalCopilotHolders` store.
   *
   * Uses a ref to track holder UUIDs and detect structural changes (add/remove)
   * vs in-place updates. When holders are added/removed, fully replaces groups.
   * When only updated in-place, merges store data while preserving any local
   * URL edits the user has made (tracked via `changed` and `originalUrl` flags).
   */
  const prevUuidsRef = useRef<string>("");
  useEffect(() => {
    const currentUuids = externalCopilotHolders.map((h) => h.uuid).join(",");
    if (currentUuids !== prevUuidsRef.current) {
      prevUuidsRef.current = currentUuids;
      dispatch({
        groups: externalCopilotHolders.map((h) => normalizeHolder(h)),
      });
    } else {
      dispatch({
        groups: (prev) =>
          externalCopilotHolders.map((h) => {
            const local = prev.find((g) => g.uuid === h.uuid);
            const normalizedHolder = normalizeHolder(h);
            if (local?.changed) {
              return {
                ...normalizedHolder,
                url: local.url,
                changed: true,
                originalUrl: local.originalUrl,
              };
            }
            return normalizedHolder;
          }),
      });
    }
  }, [externalCopilotHolders, dispatch]);

  /**
   * Persists a partial update (or deletion) of a holder to the backend and
   * syncs the result into the global store. Reads fresh state from the store
   * to avoid stale closure issues across async boundaries.
   */
  const updateHolder = useCallback(
    async (holderUuid: string, partialHolder: Partial<HolderGroup> | "delete") => {
      const store = useCopilotStore.getState();
      const externalHolders = [...store.externalCopilotHolders];
      const idx = externalHolders.findIndex((h) => h.uuid === holderUuid);
      if (idx === -1) return;

      const holderToUpdate = externalHolders[idx];

      if (partialHolder === "delete") {
        await removeCustomCopilot(holderToUpdate.uuid);
        externalHolders.splice(idx, 1);
        store.setExternalCopilotHolders(externalHolders);
      } else {
        const holder = {
          ...holderToUpdate,
          ...partialHolder,
          enabled: partialHolder.enabled ?? holderToUpdate.enabled ?? true,
        };
        holder.copilots = (holder.copilots || []).map((agent) => {
          for (const [key, value] of Object.entries(agent?.endpoints || {})) {
            agent.endpoints[key] = createURLString(value, holder.url);
          }
          return { ...agent, headers: holder.headers || {} };
        });
        await putCustomCopilot(holder);
        externalHolders[idx] = holder;
        store.updateExternalCopilotHolders(externalHolders);
      }
    },
    [],
  );

  /**
   * Fetches fresh agent data for a holder and persists the result.
   * Reads fresh holders from the store after the async fetch to avoid
   * acting on stale closure-captured state.
   */
  const handleSaveRefresh = useCallback(
    async (holderUuid: string, opts?: { silent?: boolean }): Promise<boolean> => {
      const silent = opts?.silent ?? false;
      const holder = useCopilotStore
        .getState()
        .externalCopilotHolders.find((h) => h.uuid === holderUuid);
      if (!holder) return false;

      const localGroup = state.groups.find((g) => g.uuid === holderUuid);
      const isChanged = localGroup?.changed;
      const toastId = isChanged ? `update-url-${holderUuid}` : `refresh-${holderUuid}`;

      try {
        const copilots = await fetchAgentsData(holder);
        const freshHolders = useCopilotStore.getState().externalCopilotHolders;
        const existingCopilots = freshHolders
          .filter((g) => g.uuid !== holder.uuid)
          .flatMap((g) => g.copilots || []);
        if (hasCopilotConflict(copilots, existingCopilots)) return false;

        await updateHolder(holderUuid, {
          copilots,
          status: "success",
          enabled: true,
        });

        if (!silent) {
          toast.success(
            isChanged
              ? "Your changes to the URL have been saved"
              : "Agents refreshed successfully",
            { id: toastId },
          );
        }
        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : isChanged
              ? "Failed to update URL"
              : "Failed to refresh agents";
        const toastTitle = isChanged
          ? "Failed to update URL"
          : "Failed to refresh agents";
        try {
          await updateHolder(holderUuid, { status: "error" });
        } catch (_) {}
        if (!silent) {
          toast.error(toastTitle, {
            id: toastId,
            description: errorMessage,
          });
        }
        return false;
      }
    },
    [state.groups, updateHolder],
  );

  /**
   * Refreshes every holder in one pass (silently), then shows a single summary
   * toast. Mirrors the Connections page "Refresh all" affordance.
   */
  const handleRefreshAll = useCallback(async () => {
    const holders = useCopilotStore.getState().externalCopilotHolders;
    if (holders.length === 0) return;

    dispatch({ isRefreshing: true });
    try {
      const results = await Promise.all(
        holders.map((h) => handleSaveRefresh(h.uuid, { silent: true })),
      );
      const failed = results.filter((ok) => !ok).length;
      if (failed === 0) {
        toast.success("Agents refreshed");
      } else {
        toast.error(`Failed to refresh ${failed} agent${failed !== 1 ? "s" : ""}`);
      }
    } finally {
      dispatch({ isRefreshing: false });
    }
  }, [dispatch, handleSaveRefresh]);

  const setGroupEnabled = useCallback(
    async (holderUuid: string, enabled: boolean) => {
      const holderToUpdate = useCopilotStore
        .getState()
        .externalCopilotHolders.find((h) => h.uuid === holderUuid);
      if (!holderToUpdate) return;

      await updateHolder(holderUuid, { enabled });

      if (
        !enabled &&
        selectedCopilot &&
        holderToUpdate.copilots?.some((c) => c.id === selectedCopilot.id)
      ) {
        setSelectedCopilot(getDefaultCopilot());
      }
    },
    [updateHolder, selectedCopilot, setSelectedCopilot],
  );

  const confirmDeleteGroup = useCallback(async () => {
    const uuidToDelete = state.groupToDelete;
    if (!uuidToDelete) return;

    const holderToDelete = useCopilotStore
      .getState()
      .externalCopilotHolders.find((h) => h.uuid === uuidToDelete);
    if (!holderToDelete) return;

    try {
      await updateHolder(uuidToDelete, "delete");
      toast.success("Agent group deleted successfully");

      if (
        selectedCopilot &&
        holderToDelete.copilots?.some((c) => c.id === selectedCopilot.id)
      ) {
        setSelectedCopilot(getDefaultCopilot());
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete group");
    } finally {
      dispatch({ groupToDelete: null });
    }
  }, [state.groupToDelete, updateHolder, selectedCopilot, setSelectedCopilot]);

  const handleEditGroup = useCallback(
    (holderUuid: string) => {
      const holder = externalCopilotHolders.find((h) => h.uuid === holderUuid);
      const headers = holder?.headers || {};
      const headerPairs = Object.entries(headers).map(([key, value]) => ({
        key,
        value,
      }));
      dispatch({
        editGroup: {
          uuid: holderUuid,
          url: holder?.url || "",
          headerPairs,
        },
      });
    },
    [externalCopilotHolders],
  );

  /**
   * Validates edited header pairs, fetches fresh agent data with the new
   * URL/headers, and persists the update.
   */
  const handleSaveEdit = useCallback(
    async (editGroupData: AgentManagementState["editGroup"] & { url: string }) => {
      if (!editGroupData) return;

      const { uuid: holderUuid, headerPairs, url } = editGroupData;
      const filteredPairs = headerPairs.filter((p) => p.key.trim());
      const allKeys = filteredPairs.map((p) => p.key);

      if (allKeys.length !== new Set(allKeys).size) {
        toast.error("Duplicate header keys found");
        return;
      }

      const headers = filteredPairs.reduce(
        (acc, pair) => {
          acc[pair.key] = pair.value;
          return acc;
        },
        {} as Record<string, string>,
      );

      try {
        const copilots = await fetchAgentsData({ url, headers });
        await updateHolder(holderUuid, {
          url,
          headers,
          copilots,
          status: "success",
          enabled: true,
        });
        toast.success("Agent settings updated");
      } catch (error) {
        try {
          await updateHolder(holderUuid, { status: "error" });
        } catch (_) {}
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update agent settings";
        toast.error("Failed to update agent settings", {
          description: errorMessage,
        });
        return;
      } finally {
        dispatch({ editGroup: null });
      }
    },
    [updateHolder],
  );

  const handleDeleteGroup = useCallback(
    (uuid: string) => dispatch({ groupToDelete: uuid }),
    [dispatch],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      if (inputRef.current && !value) inputRef.current.value = value;
    },
    [setSearch],
  );

  const filteredGroups = useMemo(() => {
    if (!debouncedSearch) return state.groups;
    const term = debouncedSearch.toLowerCase();
    return state.groups.reduce<HolderGroup[]>((acc, holder) => {
      const filtered = holder.copilots?.filter(
        (agent) =>
          agent.name.toLowerCase().includes(term) ||
          agent.description?.toLowerCase().includes(term),
      );
      if (
        (filtered && filtered.length > 0) ||
        holder.url?.toLowerCase().includes(term)
      ) {
        acc.push({ ...holder, copilots: filtered });
      }
      return acc;
    }, []);
  }, [state.groups, debouncedSearch]);

  return {
    state,
    dispatch,
    handleSaveRefresh,
    handleRefreshAll,
    isRefreshing: state.isRefreshing,
    setGroupEnabled,
    confirmDeleteGroup,
    handleEditGroup,
    handleSaveEdit,
    handleDeleteGroup,
    handleSearchChange,
    filteredGroups,
    search,
    debouncedSearch,
    inputRef,
    setShowAddAgentsDialog,
  };
}
