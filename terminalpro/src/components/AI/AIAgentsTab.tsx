import { useCallback, useMemo, useState } from "react";
import { AddCopilotDialog } from "~/components/AI/AddCopilotDialog";
import { AgentEditDialog } from "~/components/AI/AgentEditDialog";
import type { HolderGroup } from "~/components/AI/hooks/useAgentManagement";
import { useAgentManagement } from "~/components/AI/hooks/useAgentManagement";
import { Button } from "~/components/ds/atoms/Button";
import { ConnectionStatusDot } from "~/components/ds/atoms/ConnectionStatusDot";
import { Tag } from "~/components/ds/atoms/Tag";
import { ConfirmDialog } from "~/components/ds/dialogs/ConfirmDialog";
import Avatar from "~/components/General/Avatar";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import Icon from "~/components/Icon";
import {
  TabPageEmptyState,
  TabPageLayout,
  TabPageSearchInput,
  TabPageToolbar,
} from "~/components/shared/TabPage";
import Tooltip from "~/components/Tooltip";
import { getDefaultCopilot } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { cn } from "~/lib/utils";

export function AIAgentsTab() {
  const aiCopilotOpenBBCopilotFF = getConfig().copilot.openbbCopilot;
  const {
    state,
    dispatch,
    handleSaveRefresh,
    handleRefreshAll,
    isRefreshing,
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
  } = useAgentManagement();

  const defaultCopilot = getDefaultCopilot();
  const searchTerm = debouncedSearch.toLowerCase().trim();
  const showDefaultCopilot =
    aiCopilotOpenBBCopilotFF &&
    (!searchTerm ||
      defaultCopilot.name.toLowerCase().includes(searchTerm) ||
      defaultCopilot.description.toLowerCase().includes(searchTerm));

  const hasNoAgents = state.groups.length === 0 && !aiCopilotOpenBBCopilotFF;
  const showNoResults =
    debouncedSearch && !showDefaultCopilot && filteredGroups.length === 0;

  return (
    <>
      <TabPageLayout>
        <TabPageToolbar className="flex-nowrap">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <TabPageSearchInput
              ref={inputRef}
              placeholder="Search for agents"
              defaultValue={search}
              onChange={handleSearchChange}
              className="w-full min-w-[120px] max-w-[420px]"
            />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {state.groups.length > 0 && (
              <Tooltip message="Refresh agents">
                <Button
                  className="h-8 w-8"
                  variant="secondary"
                  onClick={handleRefreshAll}
                  disabled={isRefreshing}
                  loading={isRefreshing}
                  loadingChildren={null}
                >
                  <Icon id="refresh-icon-ds" className="w-4 min-w-4 h-4 min-h-4" />
                </Button>
              </Tooltip>
            )}
            <Button
              size="sm"
              variant="primary"
              onClick={() => setShowAddAgentsDialog(true)}
            >
              Add Agent
            </Button>
          </div>
        </TabPageToolbar>

        <div className="flex flex-col gap-4">
          {hasNoAgents ? (
            <TabPageEmptyState
              title="No AI Agent added"
              description="You haven't added any AI Agent yet."
            />
          ) : showNoResults ? (
            <SearchResultsNotFound
              extraClassName="rounded-lg bg-general-bg-primary p-12 h-[200px]"
              icon={true}
            />
          ) : (
            <>
              {showDefaultCopilot && <DefaultAgentCard />}
              {filteredGroups.map((holder) => (
                <AgentHolderSection
                  key={holder.uuid}
                  holder={holder}
                  onSaveRefresh={handleSaveRefresh}
                  onSetGroupEnabled={setGroupEnabled}
                  onEditGroup={handleEditGroup}
                  onDeleteGroup={handleDeleteGroup}
                />
              ))}
            </>
          )}
        </div>
      </TabPageLayout>
      <AddCopilotDialog />

      <ConfirmDialog
        open={state.groupToDelete !== null}
        onClose={() => dispatch({ groupToDelete: null })}
        title="Delete Agent Group"
        description="Are you sure you want to delete this agent group? This action is irreversible."
        confirmText="Delete"
        onConfirm={confirmDeleteGroup}
      />

      {state.editGroup !== null && (
        <AgentEditDialog
          editGroup={state.editGroup}
          onClose={() => dispatch({ editGroup: null })}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
}

function DefaultAgentCard() {
  const defaultCopilot = getDefaultCopilot();

  return (
    <div className="rounded-md border border-general-border-secondary bg-general-bg-primary p-3.5">
      <div className="flex items-center gap-2">
        <Avatar
          className="size-6 rounded flex-shrink-0"
          variant="noVariant"
          src={defaultCopilot.image}
          alt={defaultCopilot.name}
          fallback={
            <div className="size-6 bg-general-bg-secondary rounded flex items-center justify-center">
              <Icon id="stars-02" className="size-4 text-ds-text-body" />
            </div>
          }
        />
        <span className="text-xs font-medium text-ds-text-heading">
          {defaultCopilot.name}
        </span>
        <Tag color="grey">Default</Tag>
      </div>
      <hr className="my-3 border-general-border-secondary" />
      <p className="text-xs text-ds-text-body leading-[18px]">
        {defaultCopilot.description}
      </p>
    </div>
  );
}

function AgentHolderSection({
  holder,
  onSaveRefresh,
  onSetGroupEnabled,
  onEditGroup,
  onDeleteGroup,
}: {
  holder: HolderGroup;
  onSaveRefresh: (holderUuid: string, opts?: { silent?: boolean }) => Promise<boolean>;
  onSetGroupEnabled: (uuid: string, enabled: boolean) => Promise<void>;
  onEditGroup: (uuid: string) => void;
  onDeleteGroup: (uuid: string) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isConnected = (holder.enabled ?? true) && holder.status !== "error";

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onSaveRefresh(holder.uuid);
    } finally {
      setIsRefreshing(false);
    }
  }, [holder.uuid, onSaveRefresh]);

  const handleToggleConnection = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isConnected) {
        await onSetGroupEnabled(holder.uuid, false);
      } else {
        await onSetGroupEnabled(holder.uuid, true);
        await onSaveRefresh(holder.uuid);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, holder.uuid, onSaveRefresh, onSetGroupEnabled]);

  const holderLabel = useMemo(() => {
    try {
      return new URL(holder.url).hostname;
    } catch {
      return holder.url;
    }
  }, [holder.url]);

  return (
    <>
      {holder.copilots?.map((agent) => (
        <div
          key={agent.id}
          className="group rounded-md border border-general-border-secondary bg-general-bg-primary p-3.5"
        >
          <div className="flex items-center gap-2 overflow-x-auto">
            <Avatar
              className="size-6 rounded flex-shrink-0"
              variant="noVariant"
              src={agent.image}
              alt={agent.name}
              fallback={
                <div className="size-6 bg-general-bg-secondary rounded flex items-center justify-center">
                  <Icon id="stars-02" className="size-4 text-ds-text-body" />
                </div>
              }
            />
            <span className="text-xs font-medium text-ds-text-heading whitespace-nowrap">
              {agent.name}
            </span>
            <span className="text-xs text-ds-text-caption truncate">{holderLabel}</span>
            <div className="flex items-center gap-3 shrink-0 ml-auto">
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity duration-200">
                <Tooltip message="Refresh">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-1 hover:bg-general-bg-primary-hover rounded"
                  >
                    <Icon
                      id="refresh-icon-ds"
                      className={cn(
                        "size-3.5 text-ds-text-body",
                        isRefreshing && "animate-spin",
                      )}
                    />
                  </button>
                </Tooltip>
                <Tooltip message="Edit Settings">
                  <button
                    onClick={() => onEditGroup(holder.uuid)}
                    className="p-1 hover:bg-general-bg-primary-hover rounded"
                  >
                    <Icon id="pencil-02" className="size-3.5 text-ds-text-body" />
                  </button>
                </Tooltip>
                <Tooltip message="Delete">
                  <button
                    onClick={() => onDeleteGroup(holder.uuid)}
                    className="p-1 hover:bg-general-bg-primary-hover rounded"
                  >
                    <Icon id="trash-04" className="size-3.5 text-ds-text-body" />
                  </button>
                </Tooltip>
              </div>
              <ConnectionStatusDot
                status={
                  isLoading ? "pending" : isConnected ? "connected" : "disconnected"
                }
                size="md"
              />
              <Button onClick={handleToggleConnection} variant="secondary" size="xs">
                {isConnected ? "Disconnect" : "Connect"}
              </Button>
            </div>
          </div>
          <hr className="my-3 border-general-border-secondary" />
          <p className="text-xs text-ds-text-body leading-[18px]">
            {agent.description}
          </p>
        </div>
      ))}
    </>
  );
}
