import { cloneDeep } from "lodash";
import posthog from "posthog-js";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type CustomCopilot,
  fetchAgentsData,
  hasCopilotConflict,
  putCustomCopilot,
  removeCustomCopilot,
} from "~/api/auth.api";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import { getDefaultCopilot } from "~/lib/constants";
import { useShallowAuthStore } from "~/lib/state/auth";
import {
  type ExternalCopilotHolder,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, createURLString } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import { Input } from "../ds/atoms/Input";
import { Label } from "../ds/atoms/Label";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ds/dialogs/Dialog";
import { ConnectionTestResult } from "../ds/molecules/ConnectionTestResult";
import Avatar from "../General/Avatar";
import Icon from "../Icon";

async function validateApiKey(
  apiKey: string,
  endpoint: string,
  data?: Record<string, any>,
): Promise<TestResult> {
  try {
    const response = await fetch(endpoint, {
      method: data ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    const responseText = await response.text();

    if (!response.ok) {
      let responseData: Record<string, any>;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = {};
      }
      return {
        status: response.status,
        message:
          responseData?.error?.message || responseText || "Unknown error occurred.",
      };
    }

    return { status: response.status, message: "Validation successful." };
  } catch (error) {
    console.error("Error during API validation:", error);
    if (error instanceof TypeError) {
      return { status: 500, message: "Validation failed." };
    }
    return { status: 500, message: error.message };
  }
}

interface TestResult {
  status: number;
  message?: string;
}

function CopilotApiKeyInput({
  description,
  label,
  placeholder,
  value,
  onChange,
  onValidate,
}: {
  label: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onValidate: () => Promise<TestResult>;
}) {
  const [state, dispatch] = useStateReducer({
    isValidating: false,
    testResult: null as TestResult | null,
  });

  return (
    <div className="flex flex-col gap-1">
      <label className="body-xs-bold">{label}</label>
      <p className="text-xs text-light-300">{description}</p>
      <div className="flex items-center gap-2.5 my-1">
        <div className="flex-1">
          <Input
            size="sm"
            placeholder={placeholder}
            value={value}
            id="api-key"
            onChange={(value) => {
              onChange(value as string);
              dispatch({ testResult: null });
            }}
          />
        </div>
        <Button
          size="xs"
          variant="secondary"
          onClick={() => {
            dispatch({ isValidating: true });
            onValidate().then((testResult) => {
              dispatch({ isValidating: false, testResult });
            });
          }}
          disabled={!value}
          loading={state.isValidating}
        >
          {state.isValidating
            ? "Validating..."
            : state?.testResult?.status === 200
              ? "Validated"
              : "Validate"}
        </Button>
      </div>
      {state.testResult && (
        <ConnectionTestResult
          status={state.testResult.status === 200 ? "success" : "error"}
          message={
            state.testResult.status === 200
              ? "API key is valid!"
              : state.testResult.message
          }
          className="mt-2"
        />
      )}
    </div>
  );
}

function CopilotApiKeyDialog() {
  const { apiKeyDialogOpen, onClose, debouncedUpdateSettings } = useShallowThemeStore(
    (state) => ({
      apiKeyDialogOpen: state.apiKeyDialogOpen,
      onClose: () => state.setApiKeyDialogOpen(false),
      debouncedUpdateSettings: state.debouncedUpdateSettings,
    }),
  );

  const { openaiApiKey, setCopilotApiKeys } = useShallowAuthStore((state) => ({
    openaiApiKey: state.openaiApiKey,
    setCopilotApiKeys: state.setCopilotApiKeys,
  }));

  const [state, dispatch] = useStateReducer({ openaiApiKey });

  const handleValidateApiKey = useCallback(
    async (type: "openai") => {
      const apiKey = state[`${type}ApiKey`];
      let result: TestResult = { status: 0, message: "" };

      if (type === "openai") {
        result = await validateApiKey(apiKey, "https://api.openai.com/v1/models");
      }

      return result;
    },
    [state.openaiApiKey],
  );

  const handleOnClick = useCallback(
    (type: "saved" | "cleared") => {
      const isCleared = type === "cleared";

      setCopilotApiKeys(isCleared ? {} : state);

      toast.success(`API key ${type}`, {
        id: `copilot_api_key_${type}`,
        description:
          isCleared || !state.openaiApiKey
            ? "OpenBB Copilot will now use the default API key."
            : "OpenBB Copilot will now use this API key.",
      });
      posthog?.capture(`copilot_api_key_${type}`);
      onClose();
      debouncedUpdateSettings();
    },
    [state, debouncedUpdateSettings],
  );

  useEffect(() => {
    if (apiKeyDialogOpen) {
      dispatch({ openaiApiKey });
    }
  }, [apiKeyDialogOpen]);

  return (
    <BaseDialog open={apiKeyDialogOpen} onClose={onClose}>
      <DialogTitle>Add API Keys</DialogTitle>
      <span>Please be aware that from now on your API key will be used.</span>
      <div className="dark:bg-dark-800 bg-light-50 p-3 rounded space-y-8">
        <CopilotApiKeyInput
          label="OpenAI API key"
          description=""
          placeholder="sk-1234567890abcdefg"
          value={state.openaiApiKey}
          onChange={(openaiApiKey) => dispatch({ openaiApiKey })}
          onValidate={() => handleValidateApiKey("openai")}
        />
      </div>
      <div className="text-light-600 dark:text-light-400" />
      <DialogFooter className="flex justify-between">
        <div />
        <div className="flex gap-2">
          <DialogClose asChild={true}>
            <Button size="sm" variant="outlined">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={() => handleOnClick("saved")}
            disabled={state.openaiApiKey === openaiApiKey}
          >
            Save
          </Button>
        </div>
      </DialogFooter>
    </BaseDialog>
  );
}

type HolderGroup = ExternalCopilotHolder & { changed?: boolean; originalUrl?: string };

type AgentConfigState = {
  groups: HolderGroup[];
  groupToDelete: number | null;
  authEditGroup: {
    index: number;
    headerPairs: { key: string; value: string }[];
  } | null;
  searchTerm: string;
};

export function AgentConfigDialog() {
  const { agentConfigDialogOpen, setAgentConfigDialogOpen, setShowAddAgentsDialog } =
    useShallowThemeStore((state) => ({
      agentConfigDialogOpen: state.agentConfigDialogOpen,
      setAgentConfigDialogOpen: state.setAgentConfigDialogOpen,
      setShowAddAgentsDialog: state.setShowAddAgentsDialog,
    }));

  const onClose = useCallback(() => setAgentConfigDialogOpen(false), []);

  const {
    externalCopilotHolders,
    updateExternalCopilotHolders,
    setExternalCopilotHolders,
    selectedCopilot,
    setSelectedCopilot,
  } = useShallowCopilotStore((copilot) => ({
    externalCopilotHolders: copilot.externalCopilotHolders,
    setExternalCopilotHolders: copilot.setExternalCopilotHolders,
    updateExternalCopilotHolders: copilot.updateExternalCopilotHolders,
    selectedCopilot: copilot.selectedCopilot,
    setSelectedCopilot: copilot.setSelectedCopilot,
  }));

  const [state, dispatch] = useStateReducer<AgentConfigState>({
    groups: [],
    groupToDelete: null,
    authEditGroup: null,
    searchTerm: "",
  });

  const updateHolder = useCallback(
    async (groupIndex: number, partialHolder: Partial<HolderGroup> | `delete`) => {
      const externalHolders = [...externalCopilotHolders];
      const holderToUpdate = externalHolders[groupIndex];
      if (!holderToUpdate) return;

      if (partialHolder === "delete") {
        await removeCustomCopilot(holderToUpdate.uuid);
        externalHolders.splice(groupIndex, 1);
        setExternalCopilotHolders(externalHolders);
      } else {
        const holder = { ...holderToUpdate, ...partialHolder };

        // Ensure each agent has the latest headers and valid URLs
        holder.copilots = (holder.copilots || []).map((agent) => {
          for (const [key, value] of Object.entries(agent?.endpoints || {})) {
            agent.endpoints[key] = createURLString(value, holder.url);
          }
          return { ...agent, headers: holder.headers || {} };
        });
        await putCustomCopilot(holder);
        externalHolders[groupIndex] = holder;
        updateExternalCopilotHolders(externalHolders);
      }
    },
    [externalCopilotHolders, updateExternalCopilotHolders, setExternalCopilotHolders],
  );

  const filteredCopilotHolders = useMemo(() => {
    const trimmedSearch = state.searchTerm.trim();
    const searchLower = state.searchTerm.toLowerCase();

    if (!trimmedSearch) return state.groups;

    return state.groups.reduce((acc, holder) => {
      const filteredGroup = holder.copilots?.filter((agent) => {
        if (agent.id === "openbb-copilot") return false;
        if (!trimmedSearch) return true;

        return agent.name.toLowerCase().includes(searchLower);
      });
      if (filteredGroup?.length > 0) {
        acc.push({ ...holder, copilots: filteredGroup });
      }
      return acc;
    }, [] as ExternalCopilotHolder[]);
  }, [state.groups, state.searchTerm]);

  const handleSaveRefresh = useCallback(
    async (groupIndex: number, silent = false) => {
      const holder = state.groups[groupIndex];
      if (!holder) return;

      const isChanged = holder.changed;
      const toastId = isChanged ? `update-url-${groupIndex}` : `refresh-${groupIndex}`;
      const existingCopilots = state.groups
        .flatMap((g) => g.copilots || [])
        .filter((a) => a.holderUuid !== holder.uuid);

      try {
        // Add minimum delay to show loading state
        const startTime = Date.now();

        const copilots = await fetchAgentsData(holder as CustomCopilot);
        if (hasCopilotConflict(copilots, existingCopilots)) return;

        await updateHolder(groupIndex, { ...holder, copilots, status: "success" });

        // Ensure minimum loading time of 800ms
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 800 - elapsedTime);

        if (remainingTime > 0)
          await new Promise((resolve) => setTimeout(resolve, remainingTime));

        if (!silent) {
          if (isChanged)
            return toast.success("Your changes to the URL have been saved", {
              id: toastId,
            });
          toast.success("Agents refreshed successfully", { id: toastId });
        }
      } catch (error) {
        if (silent) throw error;

        if (isChanged) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to update URL and refresh agents";

          console.error("Error updating URL:", error);

          toast.error(errorMessage, { id: toastId });
          return;
        }
        console.error("Error refreshing agents:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to refresh agents",
          { id: toastId },
        );
      }
    },
    [state.groups, updateHolder],
  );

  const confirmDeleteGroup = useCallback(async () => {
    const groupToDelete = state.groupToDelete;
    const holderToDelete = externalCopilotHolders?.[groupToDelete];
    if (!holderToDelete) return;

    try {
      await updateHolder(groupToDelete, "delete");
      toast.success("Group deleted successfully", { id: "delete-group" });

      // If the selected copilot belongs to this group, clear the selection
      if (
        selectedCopilot &&
        holderToDelete?.copilots?.some((copilot) => copilot.id === selectedCopilot.id)
      ) {
        setSelectedCopilot(getDefaultCopilot());
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete group", {
        id: "delete-group",
      });
    } finally {
      dispatch({ groupToDelete: null });
    }
  }, [
    state.groupToDelete,
    externalCopilotHolders,
    updateHolder,
    selectedCopilot,
    setSelectedCopilot,
  ]);

  const cancelDeleteGroup = useCallback(() => {
    dispatch({ groupToDelete: null });
  }, []);

  const handleAuthGroup = useCallback(
    (groupIndex: number) => {
      const holder = externalCopilotHolders[groupIndex];
      const headers = holder?.headers || {};
      // Convert headers object to array of key-value pairs
      const headerPairs = Object.entries(headers).map(([key, value]) => ({
        key,
        value,
      }));
      // If no headers exist, add a default empty pair for user convenience
      if (headerPairs.length === 0) {
        headerPairs.push({ key: "", value: "" });
      }
      dispatch({
        authEditGroup: {
          index: groupIndex,
          headerPairs,
        },
      });
    },
    [externalCopilotHolders],
  );

  const handleSaveAuth = useCallback(
    async (authEditGroup: AgentConfigState["authEditGroup"]) => {
      const holder = state.groups[authEditGroup?.index];
      if (!holder) return;

      // Check for duplicate keys before saving
      const { index: groupIndex, headerPairs } = authEditGroup;
      const allKeys = headerPairs.map((pair) => pair.key);
      const uniqueKeys = new Set(allKeys);

      if (allKeys.length !== uniqueKeys.size) {
        toast.error(
          "Duplicate header keys found. Please ensure all header keys are unique.",
          { id: "auth-update" },
        );
        return;
      }

      // Check for empty keys
      const hasEmptyKeys = headerPairs.some((pair) => !pair.key.trim());
      if (hasEmptyKeys) {
        toast.error("Header keys cannot be empty. Please provide valid header names.", {
          id: "auth-update",
        });
        return;
      }

      // Convert headerPairs back to headers object
      const headers = headerPairs.reduce(
        (acc, pair) => {
          acc[pair.key] = pair.value;
          return acc;
        },
        {} as Record<string, string>,
      );

      try {
        const copilots = await fetchAgentsData({ ...holder, headers });
        await updateHolder(groupIndex, { headers, copilots, status: "success" });

        toast.success("Authentication settings updated", { id: "auth-update" });
      } catch (error) {
        console.error("Error updating authentication headers:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to update authentication headers",
          { id: "auth-update" },
        );
        return;
      } finally {
        dispatch({ authEditGroup: null });
      }
    },
    [updateHolder, state.groups],
  );

  useEffect(() => {
    const updatedState: Partial<AgentConfigState> = {
      groups: [],
      authEditGroup: null,
      searchTerm: "",
    };
    if (agentConfigDialogOpen) {
      updatedState.groups = cloneDeep([...externalCopilotHolders]);
    }

    dispatch(updatedState);
  }, [agentConfigDialogOpen, externalCopilotHolders]);

  const handleDialogSave = useCallback(async () => {
    try {
      for (const [index, group] of state.groups.entries()) {
        if (group.changed) await handleSaveRefresh(index, true);
      }
      toast.success("All changes saved successfully", { id: "save-changes" });
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save changes", {
        id: "save-changes",
      });
      return;
    }

    onClose();
  }, [state.groups, handleSaveRefresh, onClose]);

  return (
    <>
      <BaseDialog
        open={agentConfigDialogOpen}
        onClose={onClose}
        className="w-[731px] max-w-[731px]
        sm:max-w-[90vw] md:max-w-[95vw] lg:max-w-5xl xl:max-w-6xl 2xl:max-w-[900px]
        h-auto max-h-[90vh] sm:max-h-[85vh] md:max-h-[80vh] lg:max-h-[783px]"
      >
        <DialogHeader>
          <DialogTitle>AI Agents</DialogTitle>
          <DialogDescription className="text-sm text-light-600 dark:text-light-400">
            Manage and configure AI agents that you control. These agents can be added
            from external sources and customized to fit your needs.
          </DialogDescription>
        </DialogHeader>

        <div className="w-full space-y-3.5 flex flex-col h-full min-h-0 mt-3">
          {externalCopilotHolders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-light-100 dark:bg-dark-850 rounded px-2.5 py-10 gap-6">
              <div className="flex flex-col items-center gap-2">
                <Icon
                  id="warning-icon"
                  className="w-6 h-6 text-light-500 dark:text-light-400"
                />
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-xs font-bold text-light-600 dark:text-light-400 leading-[18px]">
                    No agents have been added yet
                  </p>
                  <p className="text-xs font-normal text-light-500 dark:text-light-400 leading-[18px]">
                    Add your first AI Agent
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowAddAgentsDialog(true)}
                size="xs"
                className="!bg-brand-main hover:!bg-brand-darker h-6 px-2 !text-2xs font-medium"
              >
                <span className="text-white leading-[1.5]">
                  Add your first AI Agent
                </span>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 flex-shrink-0">
                <div className="relative">
                  <div className="absolute left-2 top-1/2 transform -translate-y-1/2 pointer-events-none z-10">
                    <Icon
                      id="magnifying-glass-icon"
                      className="h-4 w-4 text-light-400 dark:text-light-500"
                    />
                  </div>
                  <Input
                    placeholder="Search"
                    size="sm"
                    className="w-56.5 !pl-6 h-6.5 !py-0"
                    value={state.searchTerm}
                    onChange={(searchTerm: string) => dispatch({ searchTerm })}
                  />
                </div>
                <Button
                  onClick={() => setShowAddAgentsDialog(true)}
                  size="sm"
                  className="!bg-brand-main hover:!bg-brand-darker h-6.5"
                >
                  <span className="text-white">Add new Agent</span>
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <div className="space-y-4 h-full overflow-y-auto">
                  {filteredCopilotHolders.length === 0 && state.searchTerm.trim() ? (
                    <div className="flex flex-col items-center justify-center h-full text-light-600 dark:text-light-400 py-20 gap-2">
                      <Icon
                        id="warning-icon"
                        className="w-6 h-6 text-light-500 dark:text-light-400"
                      />
                      <p>No agents found.</p>
                    </div>
                  ) : (
                    filteredCopilotHolders.map((holder, groupIndex) => (
                      <AgentGroupItem
                        key={`group-${holder.uuid}`}
                        holder={holder}
                        groupIndex={groupIndex}
                        handleSaveRefresh={handleSaveRefresh}
                        handleAuthGroup={handleAuthGroup}
                        dispatch={dispatch}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {externalCopilotHolders.length > 0 && (
          <DialogFooter>
            <Button variant="outlined" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleDialogSave}>
              Save
            </Button>
          </DialogFooter>
        )}
      </BaseDialog>

      <CopilotApiKeyDialog />

      {/* Delete Confirmation Dialog */}
      {state.groupToDelete !== null && (
        <AgentDeleteConfirmDialog
          cancelDeleteGroup={cancelDeleteGroup}
          confirmDeleteGroup={confirmDeleteGroup}
        />
      )}

      {/* Authentication Settings Dialog */}
      {state.authEditGroup !== null && (
        <AgentAuthEditor
          authEditGroup={state.authEditGroup}
          dispatch={dispatch}
          handleSaveAuth={handleSaveAuth}
        />
      )}
    </>
  );
}

function AgentDeleteConfirmDialog(props: {
  cancelDeleteGroup: () => void;
  confirmDeleteGroup: () => Promise<void>;
}) {
  const { cancelDeleteGroup, confirmDeleteGroup } = props;

  const [loading, setLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await confirmDeleteGroup();
    } finally {
      setLoading(false);
    }
  }, [confirmDeleteGroup]);

  return (
    <BaseDialog open={true} onClose={cancelDeleteGroup}>
      <DialogHeader>
        <DialogTitle>Delete Agent</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this agent? This action is irreversible.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          variant="outlined"
          size="sm"
          onClick={cancelDeleteGroup}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleConfirm}
          disabled={loading}
          loading={loading}
        >
          Delete
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}

type AgentGroupItemProps = {
  holder: HolderGroup;
  groupIndex: number;
  handleSaveRefresh: (groupIndex: number) => Promise<any>;
  handleAuthGroup: (groupIndex: number) => void;
  dispatch: StateDispatch<AgentConfigState>;
};

const AgentGroupItem = memo((props: AgentGroupItemProps) => {
  const { holder, groupIndex, handleSaveRefresh, handleAuthGroup, dispatch } = props;

  const hasHeaders = useMemo(
    () => Object.keys(holder.headers || {}).length > 0,
    [holder.headers],
  );
  const [isLoading, setIsLoading] = useState(false);

  const onSaveRefreshClick = useCallback(async () => {
    setIsLoading(true);
    try {
      await handleSaveRefresh(groupIndex);
    } finally {
      setIsLoading(false);
    }
  }, [groupIndex, handleSaveRefresh]);

  const onURLChange = useCallback(
    (value: string) => {
      dispatch({
        groups: (prev) =>
          prev.map((g, index) => {
            if (index !== groupIndex) {
              return { ...g, url: g.originalUrl || g.url, changed: false };
            }

            const changed = g.originalUrl !== value;
            return {
              ...g,
              ...(!g.originalUrl && { originalUrl: g.url }),
              url: changed ? value : g.originalUrl || g.url,
              changed,
            };
          }),
      });
    },
    [groupIndex, dispatch],
  );

  return (
    <div
      key={`group-item-${holder.uuid}`}
      className="border border-light-200 dark:border-dark-600 rounded-lg p-4 relative"
    >
      {isLoading && (
        <div className="absolute inset-0 bg-white/70 dark:bg-black/50 rounded-lg flex items-center justify-center z-20">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-main" />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-light-600 dark:text-light-400 whitespace-nowrap uppercase">
            URL:
          </span>
          <Input
            value={holder.url}
            onChange={onURLChange}
            placeholder="Enter agent URL"
            size="sm"
            className="w-44"
          />
          {holder.changed && holder.url && (
            <button
              onClick={onSaveRefreshClick}
              className="p-1.5 bg-light-200 hover:bg-light-300 dark:bg-dark-500 dark:hover:bg-dark-400 rounded"
              title="Save URL"
            >
              <Icon id="check" className="h-3 w-3 text-green-500" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Auth status indicator */}
          <div className="flex items-center gap-1 mr-2">
            <span
              className={cn("text-2xs", {
                "text-green-600 dark:text-green-400": hasHeaders,
                "text-light-500 dark:text-light-600": !hasHeaders,
              })}
            >
              {hasHeaders ? "Auth" : "No Auth"}
            </span>
          </div>
          <button
            onClick={() => handleAuthGroup(groupIndex)}
            className="p-1.5 bg-light-200 hover:bg-light-300 dark:bg-dark-500 dark:hover:bg-dark-400 rounded"
            title="Configure Authentication"
          >
            <Icon
              id="security-2-svgrepo-com"
              className="h-3 w-3 text-light-700 dark:text-light-300"
            />
          </button>
          <button
            onClick={onSaveRefreshClick}
            className="p-1.5 bg-light-200 hover:bg-light-300 dark:bg-dark-500 dark:hover:bg-dark-400 rounded"
            title="Refresh Agents"
          >
            <Icon
              id="refresh-icon"
              className="h-3 w-3 text-light-700 dark:text-light-300"
            />
          </button>
          <button
            onClick={() => dispatch({ groupToDelete: groupIndex })}
            className="p-1.5 bg-light-200 hover:bg-light-300 dark:bg-dark-500 dark:hover:bg-dark-400 rounded"
            title="Delete Group"
          >
            <Icon id="trash-icon" className="h-3 w-3 text-red-500" />
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {holder?.copilots?.map((agent) => (
          <div key={agent.id} className="p-3 bg-light-50 dark:bg-dark-700 rounded-lg">
            <h3 className="font-medium text-light-800 dark:text-light-200 mb-2 text-sm">
              {agent.name}
            </h3>
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center flex-shrink-0">
                <Avatar
                  className="w-10 h-10 rounded"
                  variant="noVariant"
                  src={agent?.image}
                  alt={agent?.name}
                  fallback={
                    <div className="w-10 h-10 bg-light-200 dark:bg-dark-600 rounded flex items-center justify-center">
                      <Icon id="user-icon" className="h-5 w-5 text-light-600" />
                    </div>
                  }
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-light-600 dark:text-light-400 leading-relaxed">
                  {agent.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

type AgentAuthEditorProps = {
  authEditGroup: AgentConfigState["authEditGroup"];
  dispatch: StateDispatch<AgentConfigState>;
  handleSaveAuth: (editGroup: AgentConfigState["authEditGroup"]) => Promise<void>;
};

const AgentAuthEditor = memo((props: AgentAuthEditorProps) => {
  const { authEditGroup, dispatch, handleSaveAuth } = props;

  const inputRefs = useRef<Record<string, HTMLInputElement>>({});
  const [editGroup, setEditGroup] = useState(authEditGroup);
  const [isLoading, setIsLoading] = useState(false);

  const onChange = useCallback(
    (index: number, field: "key" | "value", value: string) => {
      setEditGroup((prev) => {
        if (!prev) return prev;
        const newPairs = [...prev.headerPairs];
        newPairs[index] = { ...newPairs[index], [field]: value };
        return { ...prev, headerPairs: newPairs };
      });

      if (inputRefs.current[`${field}-${index}`]) {
        inputRefs.current[`${field}-${index}`]!.value = value;
      }
    },
    [inputRefs],
  );

  const handleSave = useCallback(async () => {
    try {
      setIsLoading(true);
      await handleSaveAuth(editGroup);
    } finally {
      setIsLoading(false);
    }
  }, [editGroup, handleSaveAuth]);

  useEffect(() => {
    setEditGroup(authEditGroup);
    return () => {
      inputRefs.current! = {};
    };
  }, [authEditGroup]);

  if (!editGroup) return null;

  return (
    <BaseDialog
      open={true}
      onClose={() => dispatch({ authEditGroup: null })}
      className="w-[660px] max-w-[660px]"
    >
      <DialogHeader>
        <DialogTitle>Authentication Settings</DialogTitle>
        <DialogDescription>
          Configure authentication headers for this agent. These headers will be sent
          with all requests.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {editGroup.headerPairs.length === 0 ? (
          <div className="text-sm text-light-500 dark:text-light-600 py-4 text-center">
            No authentication headers configured. Click "Add Authentication" below to
            add headers.
          </div>
        ) : (
          <div className="space-y-3">
            {editGroup.headerPairs.map((pair, index) => (
              <div key={`header-${index}`} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Label className="text-xs text-light-600 dark:text-light-400 mb-1 block">
                    Key
                  </Label>
                  <Input
                    ref={(el) => (inputRefs.current[`key-${index}`] = el)}
                    size="sm"
                    placeholder="Authorization"
                    defaultValue={pair.key}
                    onChange={(newKey: string) => {
                      onChange(index, "key", newKey);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-light-600 dark:text-light-400 mb-1 block">
                    Value
                  </Label>
                  <Input
                    ref={(el) => (inputRefs.current[`value-${index}`] = el)}
                    size="sm"
                    placeholder="Bearer token..."
                    defaultValue={pair.value}
                    onChange={(newValue: string) => {
                      onChange(index, "value", newValue);
                    }}
                  />
                </div>
                <button
                  onClick={() => {
                    setEditGroup((prev) => ({
                      ...prev,
                      headerPairs: prev.headerPairs.filter((_, i) => i !== index),
                    }));
                  }}
                  className="mt-6 p-1"
                >
                  <Icon
                    id="circled-cross-icon"
                    className="h-4 w-4 text-light-600 dark:text-light-300"
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <DialogFooter className="flex justify-between">
        <Button
          variant="outlined"
          size="sm"
          onClick={() => {
            setEditGroup((prev) => ({
              ...prev,
              headerPairs: [...prev.headerPairs, { key: "", value: "" }],
            }));
          }}
        >
          + Add Authentication
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outlined"
            size="sm"
            onClick={() => dispatch({ authEditGroup: null })}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading}
            loading={isLoading}
          >
            Save
          </Button>
        </div>
      </DialogFooter>
    </BaseDialog>
  );
});
