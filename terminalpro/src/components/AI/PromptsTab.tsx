import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";
import { BackendPromptCard } from "~/components/AI/BackendPromptCard";
import { PromptCard } from "~/components/AI/PromptCard";
import { Button } from "~/components/ds/atoms/Button";
import { CollapsibleSection } from "~/components/ds/atoms/CollapsibleSection";
import { Select } from "~/components/ds/atoms/Select";
import { ConfirmDialog } from "~/components/ds/dialogs/ConfirmDialog";
import { LibraryRow, LibrarySection } from "~/components/ds/molecules/LibraryList";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import Icon from "~/components/Icon";
import useSharedPrompts from "~/components/LayoutAuth/Search/hooks/useSharedPrompts";
import {
  TabPageEmptyState,
  TabPageLayout,
  TabPageSearchInput,
  TabPageSectionHeader,
  TabPageToolbar,
} from "~/components/shared/TabPage";
import Tooltip from "~/components/Tooltip";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { type Prompt, useShallowPromptLibraryStore } from "~/lib/state/promptLibrary";

type FilterOption = {
  label: string;
  value: "all" | "personal" | "backend" | "shared";
};

const FILTER_OPTIONS: FilterOption[] = [
  { label: "All", value: "all" },
  { label: "My Prompts", value: "personal" },
  { label: "Backend", value: "backend" },
  { label: "Shared", value: "shared" },
];

const NOOP = () => {};
const EMPTY_WIDGETS: string[] = [];

interface BackendPromptTemplate {
  id: string | undefined;
  name: string;
  prompts: string[];
}

interface BackendPromptSource {
  id: string | undefined;
  name: string;
  url: string;
  templates: BackendPromptTemplate[];
}

type PromptsTabState = {
  deletePromptId: string | null;
  bulkDeleteOpen: boolean;
  selectedPrompts: Record<string, boolean>;
  filter: string;
};

const BackendPromptsSection = memo(function BackendPromptsSection({
  sources,
  count,
  open,
  onOpenChange,
  defaultExpandedBackendId,
  onDuplicate,
}: {
  sources: BackendPromptSource[];
  count: number;
  open: boolean;
  onOpenChange: () => void;
  defaultExpandedBackendId: string | null;
  onDuplicate: (prompt: string) => void;
}) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll to the specific backend section when defaultExpandedBackendId is provided
  useEffect(() => {
    if (defaultExpandedBackendId && sectionRefs.current[defaultExpandedBackendId]) {
      setTimeout(() => {
        sectionRefs.current[defaultExpandedBackendId]?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [defaultExpandedBackendId]);

  return (
    <LibraryRow>
      <CollapsibleSection
        open={open}
        onOpenChange={onOpenChange}
        header={({ isOpen }) => (
          <TabPageSectionHeader
            title="Backend Prompts"
            count={count}
            isOpen={isOpen}
            trailingContent={
              <Tooltip
                position="top"
                message="Backend prompts can only be managed from the backend"
              >
                <span className="mr-2">
                  <Icon
                    id="lock-01"
                    className="size-[18px] dark:text-light-500 text-light-600"
                  />
                </span>
              </Tooltip>
            }
          />
        )}
      >
        <div className="mt-3 ml-4 flex flex-col gap-4">
          {sources.map((source) => (
            <div
              key={source.id}
              ref={(el) => {
                sectionRefs.current[source.id] = el;
              }}
            >
              <LibrarySection
                title={source.name}
                count={source.templates.reduce((acc, t) => acc + t.prompts.length, 0)}
                description={source.url}
                defaultOpen={source.id === defaultExpandedBackendId}
                contentClassName="pt-2"
                compact
              >
                <div className="mt-2 ml-4 flex flex-col gap-3">
                  {source.templates.map((template) => (
                    <LibrarySection
                      key={template.id}
                      title={template.name}
                      count={template.prompts.length}
                      defaultOpen={source.id === defaultExpandedBackendId}
                      contentClassName="pt-2"
                      compact
                    >
                      <div className="mt-2 ml-4 flex flex-col gap-2">
                        {template.prompts.map((promptText, index) => (
                          <BackendPromptCard
                            key={`${template.id}-${index}`}
                            prompt={promptText}
                            onDuplicate={onDuplicate}
                          />
                        ))}
                      </div>
                    </LibrarySection>
                  ))}
                </div>
              </LibrarySection>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </LibraryRow>
  );
});

const PersonalPromptsSection = memo(function PersonalPromptsSection({
  prompts,
  open,
  onOpenChange,
  onMoveUp,
  onMoveDown,
  reorderEnabled,
  onEdit,
  onDelete,
  selectedPrompts,
  onToggleSelect,
}: {
  prompts: Prompt[];
  open: boolean;
  onOpenChange: () => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  reorderEnabled: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  selectedPrompts: Record<string, boolean>;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <LibraryRow>
      <CollapsibleSection
        open={open}
        onOpenChange={onOpenChange}
        header={({ isOpen }) => (
          <TabPageSectionHeader
            title="My Prompts"
            count={prompts.length}
            isOpen={isOpen}
          />
        )}
      >
        <div className="mt-2 flex flex-col gap-2">
          {prompts.map((prompt, index) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onEdit={onEdit}
              onDelete={onDelete}
              selected={!!selectedPrompts[prompt.id]}
              onToggleSelect={onToggleSelect}
              onMoveUp={reorderEnabled ? onMoveUp : undefined}
              onMoveDown={reorderEnabled ? onMoveDown : undefined}
              canMoveUp={reorderEnabled && index > 0}
              canMoveDown={reorderEnabled && index < prompts.length - 1}
            />
          ))}
        </div>
      </CollapsibleSection>
    </LibraryRow>
  );
});

const SharedPromptsSection = memo(function SharedPromptsSection({
  prompts,
  open,
  onOpenChange,
  onDuplicate,
}: {
  prompts: Array<{ id: string; prompt: string; widgets: string[]; createdAt: string }>;
  open: boolean;
  onOpenChange: () => void;
  onDuplicate: (prompt: string) => void;
}) {
  return (
    <LibraryRow>
      <CollapsibleSection
        open={open}
        onOpenChange={onOpenChange}
        header={({ isOpen }) => (
          <TabPageSectionHeader
            title="Shared with me"
            count={prompts.length}
            isOpen={isOpen}
            leadingIcon={
              <Icon
                id="user-group"
                className="size-3.5 min-w-3.5 text-brand-main dark:text-brand-lighter stroke-1.5"
              />
            }
          />
        )}
      >
        <div className="flex flex-col gap-2 mt-2">
          {prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              shared={true}
              onEdit={NOOP}
              onDelete={NOOP}
              onDuplicate={onDuplicate}
            />
          ))}
        </div>
      </CollapsibleSection>
    </LibraryRow>
  );
});

export function PromptsTab() {
  const [searchParams] = useSearchParams();
  const defaultExpandedBackendId = searchParams.get("backend");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [state, dispatch] = useStateReducer<PromptsTabState>({
    deletePromptId: null,
    bulkDeleteOpen: false,
    selectedPrompts: {},
    filter: "",
  });

  const [debouncedFilter] = useDebounceValue(state.filter, 300);
  const [filterBy, setFilterBy] = useLocalStorage<FilterOption["value"]>(
    "prompts-filter",
    "all",
  );

  const [accordionState, setAccordionState] = useLocalStorage<{
    personal: boolean;
    backend: boolean;
    shared: boolean;
  }>("prompts-library-accordion", {
    personal: true,
    backend: true,
    shared: true,
  });

  const toggleAccordion = useCallback(
    (section: "personal" | "backend" | "shared") => {
      setAccordionState((prev) => ({
        ...prev,
        [section]: !prev[section],
      }));
    },
    [setAccordionState],
  );

  const {
    setAddPromptDialogOpen,
    prompts,
    addPrompt,
    removePrompt,
    removePrompts,
    setEditingPromptId,
    reorderPrompts,
    initializePrompts,
  } = useShallowPromptLibraryStore((s) => ({
    setAddPromptDialogOpen: s.setAddPromptDialogOpen,
    prompts: s.prompts,
    addPrompt: s.addPrompt,
    removePrompt: s.removePrompt,
    removePrompts: s.removePrompts,
    setEditingPromptId: s.setEditingPromptId,
    reorderPrompts: s.reorderPrompts,
    initializePrompts: s.initializePrompts,
  }));

  const { sharedPrompts, isLoading, error } = useSharedPrompts(true);

  const apiSources = useShallowBackendConnectorStore((s) => s.apiSources);

  const backendPromptsData = useMemo<BackendPromptSource[]>(() => {
    return apiSources
      .filter((source) => source.status === "success" && source.templates?.length)
      .map((source) => ({
        id: source.uuid ?? source.id,
        name: source.name,
        url: source.url,
        templates:
          source.templates
            ?.filter((template) => template.prompts?.length)
            .map((template) => ({
              id: template.id ?? template.templateId,
              name: template.name,
              prompts: template.prompts ?? [],
            })) ?? [],
      }))
      .filter((source) => source.templates.length > 0);
  }, [apiSources]);

  const filteredBackendPrompts = useMemo(() => {
    if (!debouncedFilter) return backendPromptsData;
    const searchTerm = debouncedFilter.toLowerCase();
    return backendPromptsData
      .map((source) => ({
        ...source,
        templates: source.templates
          .map((template) => ({
            ...template,
            prompts: template.prompts.filter((prompt) =>
              prompt.toLowerCase().includes(searchTerm),
            ),
          }))
          .filter(
            (template) =>
              template.prompts.length > 0 ||
              template.name.toLowerCase().includes(searchTerm),
          ),
      }))
      .filter(
        (source) =>
          source.templates.length > 0 || source.name.toLowerCase().includes(searchTerm),
      );
  }, [backendPromptsData, debouncedFilter]);

  const handleDelete = useCallback((id: string) => {
    dispatch({ deletePromptId: id });
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (state.deletePromptId) {
      removePrompt(state.deletePromptId);
      dispatch({ deletePromptId: null });
    }
  }, [state.deletePromptId, removePrompt]);

  const handleEdit = useCallback(
    (id: string) => {
      setEditingPromptId(id);
      setAddPromptDialogOpen(true);
    },
    [setAddPromptDialogOpen, setEditingPromptId],
  );

  const handleDuplicate = useCallback(
    (promptText: string) => {
      addPrompt({ prompt: promptText, widgets: [] });
      toast.success("Prompt duplicated to your library");
    },
    [addPrompt],
  );

  const handleMoveUp = useCallback(
    (id: string) => {
      const idx = prompts.findIndex((p) => p.id === id);
      if (idx <= 0) return;
      const next = [...prompts];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      reorderPrompts(next);
    },
    [prompts, reorderPrompts],
  );

  const handleMoveDown = useCallback(
    (id: string) => {
      const idx = prompts.findIndex((p) => p.id === id);
      if (idx < 0 || idx >= prompts.length - 1) return;
      const next = [...prompts];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      reorderPrompts(next);
    },
    [prompts, reorderPrompts],
  );

  const togglePromptSelection = useCallback((id: string) => {
    dispatch({
      selectedPrompts: (prev) => {
        const next = { ...prev };
        if (next[id]) {
          delete next[id];
        } else {
          next[id] = true;
        }
        return next;
      },
    });
  }, []);

  const selectedPromptIds = useMemo(
    () => Object.keys(state.selectedPrompts),
    [state.selectedPrompts],
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedPromptIds.length > 0) {
      dispatch({ bulkDeleteOpen: true });
    }
  }, [selectedPromptIds.length]);

  const handleConfirmBulkDelete = useCallback(() => {
    const count = selectedPromptIds.length;
    removePrompts(selectedPromptIds);
    dispatch({ selectedPrompts: {}, bulkDeleteOpen: false });
    toast.success(`${count} prompt(s) deleted`);
  }, [removePrompts, selectedPromptIds]);

  const handleSearchChange = useCallback(
    (value: string) => {
      dispatch({ filter: value });
      if (inputRef.current && !value) {
        inputRef.current.value = value;
      }
    },
    [dispatch],
  );

  useEffect(() => {
    initializePrompts();
  }, [initializePrompts]);

  useEffect(() => {
    if (defaultExpandedBackendId) {
      setAccordionState((prev) => ({
        ...prev,
        backend: true,
      }));
    }
  }, [defaultExpandedBackendId, setAccordionState]);

  const filteredSharedPrompts = useMemo(() => {
    if (!debouncedFilter) return sharedPrompts;
    return sharedPrompts.filter((prompt) =>
      prompt.prompt.toLowerCase().includes(debouncedFilter.toLowerCase()),
    );
  }, [sharedPrompts, debouncedFilter]);

  const backendPromptCount = useMemo(
    () =>
      filteredBackendPrompts.reduce(
        (acc, source) =>
          acc + source.templates.reduce((tAcc, t) => tAcc + t.prompts.length, 0),
        0,
      ),
    [filteredBackendPrompts],
  );

  const filteredPersonalPrompts = useMemo(() => {
    if (!debouncedFilter) return prompts;
    return prompts.filter((prompt) =>
      prompt.prompt.toLowerCase().includes(debouncedFilter.toLowerCase()),
    );
  }, [prompts, debouncedFilter]);

  const mappedSharedPrompts = useMemo(
    () =>
      filteredSharedPrompts.map((p) => ({
        id: p.uuid,
        prompt: p.prompt,
        widgets: EMPTY_WIDGETS,
        createdAt: p.createdAt,
      })),
    [filteredSharedPrompts],
  );

  const selectedPromptsList = useMemo(
    () => prompts.filter((p) => !!state.selectedPrompts[p.id]),
    [prompts, state.selectedPrompts],
  );

  return (
    <>
      <TabPageLayout>
        <TabPageToolbar className="flex-nowrap">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <TabPageSearchInput
              ref={inputRef}
              placeholder="Search for prompts"
              defaultValue={state.filter}
              onChange={handleSearchChange}
              className="w-full min-w-[96px] max-w-[320px]"
            />
            <Select
              options={FILTER_OPTIONS}
              placeholder="Sort by"
              className="h-8 w-[84px] shrink-0"
              value={filterBy}
              onChange={(value: FilterOption["value"]) => setFilterBy(value)}
            />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {selectedPromptIds.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkDelete}
                className="h-8"
              >
                <Icon id="trash-04" className="size-3.5" />
                Delete prompt{selectedPromptIds.length > 1 ? "s" : ""}
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              onClick={() => setAddPromptDialogOpen(true)}
            >
              Add Prompt
            </Button>
          </div>
        </TabPageToolbar>

        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-lighter" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-4 text-red-500">
              Error loading shared prompts
            </div>
          ) : prompts.length === 0 &&
            backendPromptsData.length === 0 &&
            sharedPrompts.length === 0 ? (
            <TabPageEmptyState
              title="No prompts added"
              description="You haven't added any prompts yet."
            />
          ) : ((filterBy === "all" &&
              filteredPersonalPrompts.length === 0 &&
              filteredBackendPrompts.length === 0 &&
              filteredSharedPrompts.length === 0) ||
              (filterBy === "personal" && filteredPersonalPrompts.length === 0) ||
              (filterBy === "backend" && filteredBackendPrompts.length === 0) ||
              (filterBy === "shared" && filteredSharedPrompts.length === 0)) &&
            debouncedFilter ? (
            <SearchResultsNotFound
              extraClassName="rounded-lg bg-general-bg-primary p-12 h-[200px]"
              icon={true}
            />
          ) : (
            <div className="flex flex-col">
              <hr className="mt-2 border-surface-divider" />
              {filteredBackendPrompts.length > 0 &&
                (filterBy === "all" || filterBy === "backend") && (
                  <BackendPromptsSection
                    sources={filteredBackendPrompts}
                    count={backendPromptCount}
                    open={accordionState.backend}
                    onOpenChange={() => toggleAccordion("backend")}
                    defaultExpandedBackendId={defaultExpandedBackendId}
                    onDuplicate={handleDuplicate}
                  />
                )}

              {filteredPersonalPrompts.length > 0 &&
                (filterBy === "all" || filterBy === "personal") && (
                  <PersonalPromptsSection
                    prompts={filteredPersonalPrompts}
                    open={accordionState.personal}
                    onOpenChange={() => toggleAccordion("personal")}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    reorderEnabled={!debouncedFilter}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    selectedPrompts={state.selectedPrompts}
                    onToggleSelect={togglePromptSelection}
                  />
                )}

              {filteredSharedPrompts.length > 0 &&
                (filterBy === "all" || filterBy === "shared") && (
                  <SharedPromptsSection
                    prompts={mappedSharedPrompts}
                    open={accordionState.shared}
                    onOpenChange={() => toggleAccordion("shared")}
                    onDuplicate={handleDuplicate}
                  />
                )}
            </div>
          )}
        </div>
      </TabPageLayout>

      <ConfirmDialog
        open={state.deletePromptId !== null}
        onClose={() => dispatch({ deletePromptId: null })}
        title="Delete Prompt"
        description={
          <>
            <span className="block">Are you sure you want to delete this prompt?</span>
            <span className="block text-light-600 dark:text-dark-50 text-xs mt-2">
              This action cannot be undone.
            </span>
          </>
        }
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={state.bulkDeleteOpen}
        onClose={() => dispatch({ bulkDeleteOpen: false })}
        title="Delete Prompt(s)"
        description={
          <>
            <span className="block">
              Are you sure you want to delete{" "}
              <span className="font-bold">{selectedPromptIds.length}</span> selected
              prompt(s)?
            </span>
            <span className="block mt-2 max-h-40 overflow-y-auto">
              <span className="block text-light-600 dark:text-dark-50 text-xs font-medium mb-1">
                Prompts to be deleted:
              </span>
              <ul className="text-xs space-y-1">
                {selectedPromptsList.map((prompt) => (
                  <li
                    key={prompt.id}
                    className="text-light-900 dark:text-light-100 pl-2 border-l-2 border-light-200 dark:border-dark-600 truncate"
                  >
                    {prompt.prompt.slice(0, 60)}
                    {prompt.prompt.length > 60 && "..."}
                  </li>
                ))}
              </ul>
            </span>
            <span className="block text-light-600 dark:text-dark-50 text-xs mt-3">
              This action cannot be undone.
            </span>
          </>
        }
        confirmText="Yes, Delete"
        onConfirm={handleConfirmBulkDelete}
      />
    </>
  );
}
