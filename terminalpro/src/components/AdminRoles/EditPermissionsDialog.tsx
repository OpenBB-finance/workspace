import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import cloneDeep from "lodash/cloneDeep";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import {
  type EntityRolePermissions,
  putEntityRolePermissions,
} from "~/api/entity_roles.api";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useUserResourcePermissions } from "~/hooks/useUserResourcePermissions";
import {
  createAllElements,
  type ElementType,
} from "~/lib/contexts/MyDataConnectorsContext";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import type { Prompt } from "~/lib/state/promptLibrary";
import { useShallowPromptLibraryStore } from "~/lib/state/promptLibrary";
import { Button } from "../ds/atoms/Button";
import { Checkbox } from "../ds/atoms/Checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ds/atoms/DropdownMenu";
import { Input } from "../ds/atoms/Input";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "../ds/dialogs/Dialog";
import { cn } from "../ds/utils";
import { useIsFirstRender } from "../General/Table/hooks/utils";
import Icon from "../Icon";
import type { IconId } from "../Icon.types";
import Tooltip from "../Tooltip";
import ConfirmPermissionsChangesDialog, {
  type AppChanges,
  type Changes,
} from "./ConfirmPermissionsChangesDialog";
import { PermissionItemRow, type PermissionItemRowProps } from "./PermissionItemRow";
import type {
  EditPermissionsDialogProps,
  PermissionItem,
  PossibleTabValues,
} from "./types";
import { PERMISSION_TABS } from "./types";

type PermissionsData = Record<
  "data-connectors" | "templates" | "prompts",
  PermissionItem[]
>;

type EditPermissionsState = {
  searchTerm: string;
  activeTab: PossibleTabValues;
  permissionsData: PermissionsData;
  originalPermissionsData: PermissionsData;
  isBackendOpen: boolean;
  isFilesOpen: boolean;
  isConfirmDialogOpen: boolean;
  hasChanges: boolean;
};

export type ElementTypeT = Omit<ElementType, "type"> & {
  type: PermissionItem["category"];
};

/* TODO: convert this later to ds/molecules/Tabs */
function MenuTab({
  value,
  label,
  icon,
}: {
  value: string;
  label?: string | ReactNode;
  icon?: IconId;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "rounded flex gap-2.5 items-center p-2.5 text-left capitalize transition-colors body-xs-regular",
        "radix-state-active:bg-general-bg-secondary-hover radix-state-active:font-medium",
        "radix-state-inactive:text-ds-text-caption",
        "hover:bg-general-bg-primary-hover",
        value && `_button_${value}`,
      )}
    >
      <Icon id={icon} className="size-4 text-brand-lighter" />
      {label || value}
    </TabsPrimitive.Trigger>
  );
}

const buildItemUuid = (...parts: (string | undefined)[]) => parts.join(":::");

export const formatElements = (
  elemsDc: ElementType[],
  prompts: Prompt[],
): PermissionsData => {
  const result: PermissionsData = {
    "data-connectors": [],
    templates: [],
    prompts: [],
  };

  for (const category of elemsDc as ElementTypeT[]) {
    if (category.type !== "file" && category.type !== "backend") {
      continue;
    }

    // Handle data connectors
    const dataConnectors = category.items.map((item) => {
      const baseItem: PermissionItem = {
        uuid: item.uuid || item.id,
        name: item.name,
        description: item.description,
        category: category.type,
        access: undefined,
        isChecked: false,
        isOpen: false,
      };

      if ("status" in item) baseItem.status = item.status;

      // Add widgets if they exist (for both file and backend types)
      if ("widgets" in item && Array.isArray(item.widgets) && item.widgets.length > 0) {
        baseItem.widgets = item.widgets.map((widget) => ({
          // Create a composite UUID that includes both parent and widget IDs
          uuid: buildItemUuid(baseItem.uuid, widget.widgetId || widget.id),
          name: widget.name,
          description: widget.description,
          category: category.type,
          access: undefined,
          isChecked: false,
          parentUuid: baseItem.uuid,
        }));
      }

      // Add templates if they exist (backend only)
      if (
        "templates" in item &&
        Array.isArray(item.templates) &&
        item.templates.length > 0
      ) {
        result.templates.push({
          uuid: item.uuid,
          name: item.name,
          description: item.description,
          category: category.type,
          access: undefined,
          isChecked: false,
          isOpen: false,
          parentBackend: item.name,
          templates: item.templates.map((template) => {
            const uniqueWidgetIds = new Set(
              Object.values(template.tabs || {}).flatMap((tab) =>
                Object.values(tab.layout || {}).flatMap((layout) =>
                  buildItemUuid(item.uuid, layout.i),
                ),
              ) || [],
            );

            return {
              uuid: buildItemUuid(item.uuid, template.name),
              name: template.name,
              description: template.description,
              category: category.type,
              access: undefined,
              isChecked: false,
              parentUuid: item.uuid,
              appWidgetsIds: Array.from(uniqueWidgetIds).filter((id) =>
                baseItem.widgets?.some((w) => w.uuid === id),
              ),
              widgets:
                baseItem.widgets?.filter((w) => uniqueWidgetIds.has(w.uuid)) || [],
            };
          }),
        });

        for (const template of item.templates || []) {
          if ("prompts" in template && Array.isArray(template.prompts)) {
            for (const prompt of template.prompts) {
              result.prompts.push({
                uuid: buildItemUuid(item.uuid, template.name, prompt),
                name: prompt,
                category: "prompt",
                access: undefined,
                isChecked: false,
                isOpen: false,
                parentBackend: item.name,
                parentUuid: item.uuid,
                parentTemplate: template.name,
              });
            }
          }
        }
      }

      return baseItem;
    });

    result["data-connectors"].push(...dataConnectors);
  }

  for (const prompt of prompts) {
    result.prompts.push({
      uuid: prompt.id,
      name: prompt.prompt,
      category: "prompt",
      access: undefined,
      isChecked: false,
      isOpen: false,
    });
  }

  return result;
};

/**
 * Build the editor tree: the full item universe (`formatElements`) with the given
 * role's access overlaid. Pure — switching role just re-runs it, so an empty role
 * yields a clean base instead of the previous role's access. Exported for tests.
 */
export function buildPermissionsData(
  elemsDc: ElementType[],
  prompts: Prompt[],
  permissions: EntityRolePermissions[] | undefined,
): PermissionsData {
  const updatedPermissions = formatElements(elemsDc, prompts);

  for (const perm of permissions ?? []) {
    const tab = perm.category as PossibleTabValues;
    if (!updatedPermissions[tab]) continue;

    // Handle standalone prompts
    if (tab === "prompts" && !perm.uuid.includes(":::")) {
      const promptItem = updatedPermissions[tab].find(
        (item) => item.uuid === perm.uuid,
      );
      if (promptItem) {
        promptItem.access = perm.access;
      }
      continue;
    }

    // Handle backend items and their nested structures
    const dcItem = updatedPermissions["data-connectors"].find(
      (item) => item.uuid === perm.uuid && item.category === perm.type,
    );

    // If the item is not found, skip to the next one
    if (!dcItem) continue;

    // Set backend access
    dcItem.access = perm.access;
    let hasAccess = false;

    // Update widgets if they exist
    if (perm.widgets && (dcItem.widgets?.length > 0 || dcItem.status === "success")) {
      for (const widgetPerm of perm.widgets) {
        const widget = dcItem.widgets?.find(
          (w) => w.uuid === buildItemUuid(dcItem.uuid, widgetPerm.widgetId),
        );
        // If the widget is not found, skip to the next one
        if (!widget) continue;

        widget.access = widgetPerm.access;
        if (widgetPerm.access === "access") {
          hasAccess = true;
        }
      }
    } else if (perm.widgets?.length > 0) {
      // If the backend is offline we populate from permissions
      dcItem.widgets = perm.widgets.map((widget) => ({
        uuid: buildItemUuid(dcItem.uuid, widget.widgetId),
        name: "",
        description: "",
        category: dcItem.category,
        access: widget.access,
        isChecked: false,
      }));

      hasAccess = perm.widgets.some((widget) => widget.access === "access");

      if (perm.templates?.length > 0) {
        updatedPermissions.templates.push({
          uuid: dcItem.uuid,
          name: dcItem.name,
          description: dcItem.description,
          category: dcItem.category,
          access: perm.access,
          isChecked: false,
          status: dcItem.status,
          parentBackend: dcItem.name,
          templates: perm.templates.map((template) => ({
            ...template,
            uuid: buildItemUuid(dcItem.uuid, template.templateId),
            name: template.templateId,
            description: "",
            category: dcItem.category,
            access: template.access,
            isChecked: false,
            parentUuid: dcItem.uuid,
            appWidgetsIds: [],
          })),
        });

        for (const template of perm.templates) {
          if ("prompts" in template && Array.isArray(template.prompts)) {
            template.prompts.forEach((prompt) => {
              updatedPermissions.prompts.push({
                uuid: buildItemUuid(dcItem.uuid, template.templateId, prompt.promptId),
                name: prompt.promptId,
                category: "prompt",
                access: "no-access" as const,
                status: dcItem.status,
                isChecked: false,
                isOpen: false,
                parentBackend: dcItem.name,
                parentUuid: dcItem.uuid,
                parentTemplate: template.templateId,
              });
            });
          }
        }
      }
    }

    if (perm.type === "file" && hasAccess) {
      dcItem.access = "access";
    }

    // Skip Update templates and their prompts if not present
    if (!(Array.isArray(perm.templates) && perm.templates.length > 0)) continue;

    // Find corresponding template backend in templates tab
    const templateBackend = updatedPermissions.templates.find(
      (t) => t.uuid === perm.uuid,
    );

    if (!templateBackend) continue;
    templateBackend.access = perm.access;

    for (const templatePerm of perm.templates) {
      // Update template access
      const template = templateBackend.templates?.find(
        (t) => t.uuid === buildItemUuid(templateBackend.uuid, templatePerm.templateId),
      );
      if (!template) continue;
      template.access = templatePerm.access;

      // Update prompts within template
      if (!templatePerm?.prompts) continue;

      for (const promptPerm of templatePerm.prompts) {
        // Update in prompts tab
        const composedUUID = buildItemUuid(
          perm.uuid,
          templatePerm.templateId,
          promptPerm.promptId,
        );
        const promptItem = updatedPermissions.prompts.find(
          (item) => item.uuid === composedUUID,
        );
        if (!promptItem) continue;
        promptItem.access = promptPerm.access;
      }
    }
  }

  return updatedPermissions;
}

export function EditPermissionsDialog({
  open,
  setOpen,
  role,
  permissions,
  roleSelector,
}: EditPermissionsDialogProps) {
  const { storedFiles, apiSources } = useShallowBackendConnectorStore((s) => ({
    storedFiles: s.storedFiles,
    apiSources: s.apiSources,
  }));

  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => setOpen(false), [setOpen]);
  const prompts = useShallowPromptLibraryStore((state) => state.prompts);
  const queryClient = useQueryClient();
  const isFirstRender = useIsFirstRender();
  const { data: rolePermissionsData } = useUserResourcePermissions();

  const elemsDc = useMemo(
    () =>
      createAllElements({
        rolePermissionsData,
        storedFiles,
        apiSources,
        withOthers: false,
      }),
    [storedFiles, apiSources, rolePermissionsData],
  );

  const [state, dispatch] = useStateReducer<EditPermissionsState>({
    searchTerm: "",
    activeTab:
      apiSources.reduce((acc, source) => (source.templates?.length || 0) + acc, 0) > 0
        ? "templates"
        : "data-connectors",
    permissionsData: formatElements(elemsDc, prompts),
    originalPermissionsData: { "data-connectors": [], templates: [], prompts: [] },
    isBackendOpen: true,
    isFilesOpen: true,
    isConfirmDialogOpen: false,
    hasChanges: false,
  });

  const [debouncedSearch] = useDebounceValue(state.searchTerm, 300);

  // If there's a search term and matches in other tabs, show the first tab with matches
  useEffect(() => {
    if (!debouncedSearch) return;
    queueMicrotask(() => {
      const searchResults = searchResultsCb(state);
      if (searchResults.length > 0 && !searchResults.includes(state.activeTab)) {
        dispatch({ activeTab: searchResults[0] });
      }
    });
  }, [debouncedSearch]);

  useEffect(() => {
    if (!(open || isFirstRender)) {
      dispatch({
        permissionsData: formatElements(elemsDc, prompts),
        originalPermissionsData: { "data-connectors": [], templates: [], prompts: [] },
        searchTerm: "",
        activeTab: "data-connectors",
        isBackendOpen: true,
        isFilesOpen: true,
        isConfirmDialogOpen: false,
      });
    }
  }, [open, elemsDc, prompts]);

  // Get filtered items for current tab
  const { checked, currentItems, dcTabItems } = useMemo(() => {
    const allItems = state.permissionsData[state.activeTab].filter((item) => {
      if (!item?.name) return false;

      const nameMatch = item.name.toLowerCase().includes(debouncedSearch.toLowerCase());

      // Check for widget matches
      const hasMatchingWidgets = item.widgets?.some((widget) =>
        widget.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
      );

      // Check for template matches
      const hasMatchingTemplates = item.templates?.some((template) =>
        template.name.toLowerCase().includes(debouncedSearch.toLowerCase()),
      );

      // // If there are matching children, automatically expand the parent
      // if ((hasMatchingWidgets || hasMatchingTemplates) && state.searchTerm) {
      //   item.isOpen = true;
      // }

      return nameMatch || hasMatchingWidgets || hasMatchingTemplates;
    });

    const files = allItems.filter((item) => item.category === "file");
    const backends = allItems.filter((item) => item.category === "backend");

    const checked = allItems.reduce(
      (acc, item) => {
        const addCounts = (item: PermissionItem) => {
          if (item.isChecked) {
            acc.checkedItems += 1;
          }
          if (item.access === "access") {
            acc.hasAccessItems += 1;
          } else {
            acc.hasNoAccessItems += 1;
          }
          acc.totalItems += 1;
        };

        for (const key of ["widgets", "templates"]) {
          if (key in item && Array.isArray(item[key])) {
            for (const child of item[key]) {
              addCounts(child);
            }
          }
        }

        addCounts(item);

        return acc;
      },
      { totalItems: 0, checkedItems: 0, hasAccessItems: 0, hasNoAccessItems: 0 },
    );

    const allChecked = checked.checkedItems === checked.totalItems;
    const someChecked = checked.checkedItems > 0 && !allChecked;
    const hasNoAccessItems = checked.hasNoAccessItems > 0;
    const hasAccessItems = checked.hasAccessItems > 0;
    const isMixedAccess = hasNoAccessItems && hasAccessItems;

    return {
      checked: {
        allChecked,
        someChecked,
        hasNoAccessItems,
        hasAccessItems,
        isMixedAccess,
      },
      currentItems: allItems,
      dcTabItems: { files, backends },
    };
  }, [state.permissionsData[state.activeTab], debouncedSearch]);

  const handleItemCheck = useCallback(
    (uuid: string) => {
      if (uuid.includes(":::") && uuid.split(":::").length === 2) {
        const [parentId, childId] = uuid.split(":::");

        dispatch((prev) => ({
          ...prev,
          permissionsData: {
            ...prev.permissionsData,
            [prev.activeTab]: prev.permissionsData[prev.activeTab].map((item) => {
              if (item.uuid === parentId) {
                return {
                  ...item,
                  widgets: item.widgets?.map((widget) =>
                    widget.uuid === uuid
                      ? { ...widget, isChecked: !widget.isChecked }
                      : widget,
                  ),
                  templates: item.templates?.map((template) =>
                    template.uuid === uuid
                      ? { ...template, isChecked: !template.isChecked }
                      : template,
                  ),
                };
              }
              return item;
            }),
          },
        }));
        return;
      }
      dispatch((prev) => ({
        ...prev,
        permissionsData: {
          ...prev.permissionsData,
          [prev.activeTab]: prev.permissionsData[prev.activeTab].map((item) =>
            item.uuid === uuid
              ? {
                  ...item,
                  isChecked: !item.isChecked,
                  widgets: item.widgets?.map((widget) => ({
                    ...widget,
                    isChecked: !item.isChecked,
                  })),
                  templates: item.templates?.map((template) => ({
                    ...template,
                    isChecked: !item.isChecked,
                  })),
                }
              : item,
          ),
        },
      }));
    },
    [dispatch],
  );

  // Update the handleAccessChange function to use synchronizeBackendPermissions
  const handleAccessChange = useCallback(
    (
      itemId: string,
      newAccess: PermissionItem["access"],
      category: PermissionItem["category"],
    ) => {
      // Check if this is a backend item that might exist in multiple tabs
      const isBackendItem = category === "backend";

      // Handle regular permission change for non-backend items
      dispatch((prev) => {
        const newState = { ...prev };

        if (isBackendItem) {
          // Synchronize this backend's permissions across all tabs
          synchronizeBackendPermissions(newState, itemId, newAccess);
        }

        const updatedData = [...newState.permissionsData[prev.activeTab]];
        const [parentUuid, childUuid] = itemId.split(":::");
        for (const item of updatedData) {
          // If this is the item being updated
          if (item.uuid === itemId) {
            item.access = newAccess;
            continue;
          }

          // If this item has widgets, check if we need to update any of them
          if (prev.activeTab === "data-connectors" && Array.isArray(item.widgets)) {
            if (item.uuid !== parentUuid) continue;
            item.widgets = item.widgets.map((widget) =>
              widget.uuid === itemId ? { ...widget, access: newAccess } : widget,
            );
            const allNoAccess = item.widgets.every(
              (widget) => widget.access !== "access",
            );
            const anyAccess = item.widgets.some((widget) => widget.access === "access");

            const hasWidgets = item.widgets.filter((widget) => widget.name).length > 0;

            const access = allNoAccess && hasWidgets ? "no-access" : item.access;

            item.access = anyAccess ? "access" : access;

            for (const temp of newState.permissionsData.templates || []) {
              for (const template of temp.templates || []) {
                if (template.widgets?.some((w) => w.uuid === itemId)) {
                  template.widgets = template.widgets.map((w) =>
                    w.uuid === itemId ? { ...w, access: newAccess } : w,
                  );
                }
              }
            }

            continue;
          }

          if (!(prev.activeTab === "templates" && Array.isArray(item.templates)))
            continue;

          handleTemplatesAccessChange(item, newState, itemId, newAccess);
        }

        return {
          ...newState,
          permissionsData: {
            ...newState.permissionsData,
            [prev.activeTab]: updatedData,
          },
        };
      });
    },
    [dispatch],
  );

  const handleSelectAll = useCallback(() => {
    const allChecked = checked.allChecked;
    dispatch((prev) => ({
      ...prev,
      permissionsData: {
        ...prev.permissionsData,
        [prev.activeTab]: prev.permissionsData[prev.activeTab].map((item) => ({
          ...item,
          isChecked: !allChecked,
          ...(prev.activeTab === "data-connectors" && {
            widgets: item.widgets?.map((widget) => ({
              ...widget,
              isChecked: !allChecked,
            })),
          }),
          ...(prev.activeTab === "templates" && {
            templates: item.templates?.map((template) => ({
              ...template,
              isChecked: !allChecked,
            })),
          }),
        })),
      },
    }));
  }, [checked.allChecked, dispatch]);

  // Also update handleBulkAccessChange to handle backend synchronization
  const handleBulkAccessChange = useCallback(
    (access: PermissionItem["access"]) => {
      // First, collect all backend UUIDs that are checked
      const checkedBackendUuids = state.permissionsData[state.activeTab]
        .filter(
          (item) =>
            item.isChecked && item.category === "backend" && item.access !== access,
        )
        .map((item) => item.uuid);

      // Apply regular bulk changes
      dispatch((prev) => {
        const newState = { ...prev };
        const updatedData = [...newState.permissionsData[prev.activeTab]];

        for (const item of updatedData) {
          if (item.isChecked && prev.activeTab !== "templates") item.access = access;

          if (prev.activeTab === "data-connectors" && Array.isArray(item.widgets)) {
            item.widgets = item.widgets.map((widget) => ({
              ...widget,
              access: widget.isChecked ? access : widget.access,
            }));
          }

          if (prev.activeTab === "templates" && Array.isArray(item.templates)) {
            for (const template of item.templates) {
              if (template.isChecked && template.access !== access)
                handleTemplatesAccessChange(item, newState, template.uuid, access);
            }
          }
        }

        for (const uuid of checkedBackendUuids) {
          // Then synchronize each backend's permissions across tabs
          synchronizeBackendPermissions(newState, uuid, access);
        }

        return {
          ...newState,
          permissionsData: {
            ...newState.permissionsData,
            [prev.activeTab]: updatedData,
          },
        };
      });
    },
    [state.permissionsData[state.activeTab], state.activeTab, dispatch],
  );

  const handleConfirmedSubmit = useCallback(async () => {
    if (!role) return;

    try {
      // Collect permissions to update from ALL tabs, not just the active one
      const permissionsToUpdate = [];

      const promptPermissions = state.permissionsData.prompts
        .map((item) => {
          if (!item.access) return null;
          if (item.category === "prompt") {
            if (item.uuid.includes(":::")) {
              // Handle backend prompts (format: backendUuid:templateId:promptId)
              if (item.uuid.split(":::").length === 3) {
                const [backendUuid, templateId, promptId] = item.uuid.split(":::");
                const templateAccess = state.permissionsData.templates
                  .find((t) => t.uuid === backendUuid)
                  ?.templates?.find(
                    (t) => t.uuid === buildItemUuid(backendUuid, templateId),
                  )?.access;

                return {
                  uuid: backendUuid,
                  category: "prompts",
                  type: item.category,
                  templates: [
                    {
                      templateId,
                      access: templateAccess,
                      prompts: [
                        {
                          promptId,
                          access: item.access,
                        },
                      ],
                    },
                  ],
                };
              }
            } else {
              // Handle standalone prompts
              return {
                uuid: item.uuid,
                access: item.access,
                category: "prompts",
                type: item.category,
              };
            }
          }
          return null;
        })
        .filter(Boolean); // Remove any null values

      const templatePermissions = state.permissionsData.templates
        .map((item) => {
          if (!item.access) return null;
          if (item.category === "backend" && Array.isArray(item.templates)) {
            const prompts = promptPermissions
              .filter((t) => t.uuid === item.uuid)
              ?.flatMap((t) => t.templates);

            return {
              uuid: item.uuid,
              access: item.access,
              category: "templates",
              type: item.category,
              templates: item.templates.map((template) => {
                const templateId = template.uuid.split(":::")[1];
                const templatePrompts = prompts
                  ?.filter((t) => t.templateId === templateId)
                  ?.flatMap((t) => t.prompts);

                const temp = { templateId, access: template.access } as any;
                if (templatePrompts) {
                  temp.prompts = templatePrompts;
                }
                return temp;
              }),
            };
          }
          return {
            uuid: item.uuid,
            access: item.access,
            category: "templates",
            type: item.category,
          };
        })
        .filter(Boolean); // Remove any null values

      // Process data connectors tab
      permissionsToUpdate.push(
        ...state.permissionsData["data-connectors"]
          .map((item) => {
            if (!item.access) return null;
            const basePermission = {
              uuid: item.uuid,
              access: item.access,
              category: "data-connectors",
              type: item.category,
            };

            if (
              (item.category === "backend" || item.category === "file") &&
              item.widgets
            ) {
              const templates = templatePermissions
                .find((t) => t.uuid === item.uuid)
                ?.templates?.filter((t) => t.access);

              const temp = {
                ...basePermission,
                widgets: item.widgets
                  .map((widget) => ({
                    widgetId: widget.uuid.split(":::")[1],
                    access: widget.access,
                  }))
                  .filter((widget) => widget.access), // Filter out widgets with no access
              } as any;

              if (templates) {
                temp.templates = templates;
              }
              return temp;
            }

            return basePermission;
          })
          .filter(Boolean), // Remove any null values
      );

      // Process templates tab
      permissionsToUpdate.push(
        ...templatePermissions.filter(
          (item) => item.type !== "backend" && !item.templates,
        ),
      );

      // Process prompts tab
      permissionsToUpdate.push(...promptPermissions.filter((item) => !item.templates));
      const response = await putEntityRolePermissions(role.uuid, permissionsToUpdate);

      if (response.success) {
        await queryClient.refetchQueries({
          queryKey: ["entityRolePermissions", role.uuid],
        });
        toast.success("Role permissions updated", {
          description: "Your role permissions were successfully updated!",
        });
        dispatch({ isConfirmDialogOpen: false });
        setOpen(false);
      } else {
        toast.error("An error occurred while updating permissions");
      }
    } catch (error) {
      console.error("Error updating permissions:", error);
      toast.error("An error occurred while updating permissions");
    }
  }, [role, dispatch, queryClient, state.permissionsData]);

  useEffect(() => {
    // Rebuild the tree from scratch and overlay the selected role's permissions.
    // Re-runs whenever `permissions` changes (e.g. switching role in the header), so
    // an empty role resets the tree instead of keeping the previous role's access.
    const updatedPermissions = buildPermissionsData(elemsDc, prompts, permissions);

    dispatch({
      permissionsData: updatedPermissions,
      // Store a deep copy of the original permissions for comparison
      originalPermissionsData: cloneDeep(updatedPermissions),
    });
  }, [open, permissions, elemsDc, prompts]);

  // Calculate permission changes summary with details
  const getPermissionChangesSummary = useCallback(() => {
    const appChanges: Record<string, AppChanges> = {};
    const libraryChanges: Changes = {
      widgets: { added: 0, removed: 0 },
      prompts: { added: 0, removed: 0 },
    };

    // Check each tab for changes
    for (const tab of PERMISSION_TABS) {
      const tabValue = tab.value;
      const originalItems = state.originalPermissionsData[tabValue] || [];
      const currentItems = state.permissionsData[tabValue];

      // Compare each item in the tab
      for (const currentItem of currentItems) {
        const originalItem = originalItems.find(
          (item) => item.uuid === currentItem.uuid,
        );
        const changes: Changes = {
          widgets: { added: 0, removed: 0 },
          prompts: { added: 0, removed: 0 },
        };

        const isApp = tabValue === "templates";

        let appUuid: string | undefined;

        const isNew = originalItem?.access === undefined;
        // Check if access has changed for main items
        if (originalItem?.access !== currentItem.access && tabValue === "prompts") {
          if (currentItem.parentUuid && currentItem.parentTemplate) {
            appUuid = buildItemUuid(currentItem.parentUuid, currentItem.parentTemplate);
          }

          // Update counts
          if (currentItem.access === "access") {
            if (appChanges[appUuid]) {
              appChanges[appUuid].prompts.added++;
            } else changes.prompts.added++;
          } else if (currentItem.access === "no-access" && !isNew) {
            if (appChanges[appUuid]) {
              appChanges[appUuid].prompts.removed++;
            } else changes.prompts.removed++;
          }
        }

        // Check widgets if they exist
        for (const widget of currentItem.widgets || []) {
          const originalWidget = originalItem?.widgets?.find(
            (w) => w.uuid === widget.uuid,
          );

          const isNewWidget = originalWidget?.access === undefined;
          if (originalWidget?.access !== widget.access) {
            if (widget.access === "access") {
              changes.widgets.added++;
            } else if (widget.access === "no-access" && !isNewWidget) {
              changes.widgets.removed++;
            }
          }
        }

        // Check templates if they exist
        for (const template of currentItem.templates || []) {
          const originalTemplate = originalItem?.templates?.find(
            (t) => t.uuid === template.uuid,
          );

          const currentDcItem = state.permissionsData["data-connectors"].find(
            (item) => item.uuid === template.parentUuid && item.category === "backend",
          );
          const originalDcItem = state.originalPermissionsData["data-connectors"].find(
            (item) => item.uuid === template.parentUuid && item.category === "backend",
          );
          if (isApp && !appChanges[template.uuid]) {
            appUuid = template.uuid;
            appChanges[appUuid] = {
              name: template.name,
              widgets: { added: 0, removed: 0 },
              prompts: { added: 0, removed: 0 },
            };
          }

          const isNewTemplate = originalTemplate?.access === undefined;
          template.appWidgetsIds = template.appWidgetsIds || [];

          if (template.access === "access") {
            for (const widgetId of template.appWidgetsIds) {
              const originalWidget = originalDcItem?.widgets?.find(
                (w) => w.uuid === buildItemUuid(template.parentUuid, widgetId),
              );
              const widget = currentDcItem?.widgets?.find(
                (w) => w.uuid === buildItemUuid(template.parentUuid, widgetId),
              );

              if (originalWidget?.access !== widget?.access) {
                if (widget?.access === "access") {
                  appChanges[appUuid].widgets.added++;
                } else if (widget?.access === "no-access") {
                  appChanges[appUuid].widgets.removed++;
                }
              }
            }

            // if widget access didn't change, set to total appWidgetsIds
            if (
              originalTemplate?.access !== template.access &&
              Object.values(appChanges[appUuid]?.widgets || {}).every((v) => v === 0)
            ) {
              if (isApp && appChanges[appUuid]) {
                appChanges[appUuid].widgets.added += template.appWidgetsIds.length;
              } else changes.widgets.added++;
            }
          } else if (
            template.access === "no-access" &&
            originalTemplate?.access !== template.access &&
            isNewTemplate
          ) {
            if (isApp && appChanges[appUuid]) {
              appChanges[appUuid].widgets.removed += template.appWidgetsIds.length;
            } else changes.widgets.removed++;
          }
        }

        if (!(isApp || appUuid)) {
          for (const key of ["widgets", "prompts"] as const) {
            libraryChanges[key].added += changes[key].added;
            libraryChanges[key].removed += changes[key].removed;
          }
        }
      }
    }

    const filteredAppChanges = Object.values(appChanges).filter((app) =>
      [app.widgets, app.prompts].some(
        (change) => change.added > 0 || change.removed > 0,
      ),
    );

    return { libraryChanges, appChanges: filteredAppChanges };
  }, [state.originalPermissionsData, state.permissionsData]);

  const handleOnToggleOpen = useCallback(
    (uuid: string, isTemplate = false) => {
      dispatch((prev) => ({
        ...prev,
        permissionsData: {
          ...prev.permissionsData,
          [prev.activeTab]: prev.permissionsData[prev.activeTab].map((item) => {
            if (isTemplate) {
              const template = item.templates?.find((t) => t.uuid === uuid);
              if (template) {
                return {
                  ...item,
                  templates: item.templates.map((t) =>
                    t.uuid === uuid ? { ...t, isOpen: !t.isOpen } : t,
                  ),
                };
              }
            }

            return item.uuid === uuid ? { ...item, isOpen: !item.isOpen } : item;
          }),
        },
      }));
    },
    [dispatch],
  );

  return (
    <>
      <BaseDialog
        open={open}
        onClose={handleClose}
        className="h-[80vh] lg:max-w-3xl xl:max-w-5xl bg-general-bg-primary flex flex-col"
      >
        <DialogTitle>
          {roleSelector ? "Setup Permissions" : `${role?.name} — Permissions`}
        </DialogTitle>
        <div className="space-y-4 flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 w-full">
            <Input
              ref={searchInputRef}
              size="sm"
              className="flex-1"
              placeholder="Search"
              prefix={<Icon id="search" />}
              clearable={true}
              defaultValue={state.searchTerm}
              onChange={(searchTerm: string) => {
                dispatch({ searchTerm });
                if (searchInputRef.current) {
                  searchInputRef.current.value = searchTerm;
                }
              }}
            />
            {roleSelector}
          </div>

          <TabsPrimitive.Root
            value={state.activeTab}
            onValueChange={(value: PossibleTabValues) => dispatch({ activeTab: value })}
            orientation="horizontal"
            className="flex flex-1 bg-tab-group-bg rounded border border-secondary/20 overflow-hidden max-h-[calc(100%-50px)]"
          >
            <TabsPrimitive.List className="flex sm:min-w-[180px] flex-col gap-1 overflow-auto p-2.5 border-r border-surface-divider">
              {PERMISSION_TABS.map((tab) => (
                <MenuTab
                  key={tab.value}
                  value={tab.value}
                  label={tab.label}
                  icon={tab.icon}
                />
              ))}
            </TabsPrimitive.List>

            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
              <div className="px-2.5 border-b border-surface-divider">
                <div className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <Icon id="edit-03" className="size-3.5 text-brand-lighter" />
                    <p className="body-xs-regular text-ds-text-body">
                      {state.activeTab === "prompts" ? (
                        <>
                          Set up and manage your prompts in the{" "}
                          <Link
                            to="/app/prompts"
                            className="text-brand-lighter underline"
                          >
                            Prompts
                          </Link>{" "}
                          page in the Workspace.
                        </>
                      ) : (
                        <>
                          Set up and manage your data integrations in the{" "}
                          <Link to="/app" className="text-brand-lighter underline">
                            Apps
                          </Link>{" "}
                          page or files in the{" "}
                          <Link
                            to="/app/widgets"
                            className="text-brand-lighter underline"
                          >
                            Widgets Library
                          </Link>{" "}
                          page in the Workspace.
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex p-1 items-center rounded bg-general-bg-primary border border-general-border-primary">
                    <DropdownMenu>
                      <Tooltip
                        position="top"
                        message="Change permissions for all items in current tab"
                      >
                        <DropdownMenuTrigger
                          className={cn(
                            "obb-small-navbar-btn rounded flex items-center justify-center size-7",
                            {
                              "opacity-50 cursor-not-allowed": !(
                                checked.someChecked || checked.allChecked
                              ),
                            },
                          )}
                        >
                          <Icon id="file-lock-02" className="size-3.5" />
                        </DropdownMenuTrigger>
                      </Tooltip>
                      <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
                        <DropdownMenuItem
                          className="pr-1 text-ds-text-caption body-xs-regular w-full flex justify-between items-center"
                          onClick={() =>
                            handleBulkAccessChange(
                              checked.isMixedAccess ? "access" : "no-access",
                            )
                          }
                          disabled={!(checked.someChecked || checked.allChecked)}
                        >
                          Mixed
                          {checked.isMixedAccess && (
                            <Icon id="check" className="size-3" />
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="pr-1 body-xs-regular w-full flex justify-between items-center"
                          onClick={() => handleBulkAccessChange("access")}
                        >
                          Access
                          {checked.hasAccessItems && !checked.hasNoAccessItems && (
                            <Icon id="check" className="size-3" />
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="pr-1 body-xs-regular w-full flex justify-between items-center"
                          onClick={() => handleBulkAccessChange("no-access")}
                        >
                          No Access
                          {!checked.hasAccessItems && checked.hasNoAccessItems && (
                            <Icon id="check" className="size-3" />
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="w-px h-5 mx-1 bg-general-border-secondary" />
                    <div className="size-6 flex items-center justify-center">
                      <Checkbox
                        checked={
                          checked.someChecked ? "indeterminate" : checked.allChecked
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Connectors Tab */}
              <TabsPrimitive.Content
                value="data-connectors"
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="p-2.5 space-y-6 flex-1 overflow-y-auto">
                  <NoMatchingResults
                    totalItems={dcTabItems.backends?.length + dcTabItems.files?.length}
                    searchTerm={debouncedSearch}
                  />

                  {dcTabItems.backends?.length > 0 && (
                    <NestedPermissionItems
                      title="Backend Widgets"
                      items={dcTabItems.backends}
                      isOpen={state.isBackendOpen}
                      onHeaderClick={() => dispatch({ isBackendOpen: (prev) => !prev })}
                      onAccessChange={handleAccessChange}
                      onCheckChange={handleItemCheck}
                      onToggleOpen={handleOnToggleOpen}
                      searchTerm={debouncedSearch}
                    />
                  )}

                  {dcTabItems.files.length > 0 && (
                    <NestedPermissionItems
                      title="Uploaded Files"
                      items={dcTabItems.files}
                      isOpen={state.isFilesOpen}
                      onHeaderClick={() => dispatch({ isFilesOpen: (prev) => !prev })}
                      onAccessChange={handleAccessChange}
                      onCheckChange={handleItemCheck}
                      onToggleOpen={handleOnToggleOpen}
                      searchTerm={debouncedSearch}
                    />
                  )}
                </div>
              </TabsPrimitive.Content>

              {/* Apps Tab */}
              <TabsPrimitive.Content
                value="templates"
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="p-2.5 space-y-6 flex-1 overflow-y-auto">
                  {currentItems.map((template, index) => (
                    <NestedPermissionItems
                      key={`${template.uuid}-${index}`}
                      title={template.parentBackend}
                      items={template.templates}
                      isOpen={template.isOpen}
                      onAccessChange={handleAccessChange}
                      onCheckChange={handleItemCheck}
                      onHeaderClick={() => handleOnToggleOpen(template.uuid)}
                      onToggleOpen={(uuid) => handleOnToggleOpen(uuid, true)}
                      searchTerm={debouncedSearch}
                    />
                  ))}

                  <NoMatchingResults
                    totalItems={currentItems?.length}
                    searchTerm={debouncedSearch}
                  />
                </div>
              </TabsPrimitive.Content>

              {/* Prompts Tab */}
              <TabsPrimitive.Content
                value="prompts"
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="p-2.5 space-y-6 flex-1 overflow-y-auto">
                  {currentItems.map((item) => (
                    <PermissionItemRow
                      key={item.uuid}
                      item={item}
                      onAccessChange={handleAccessChange}
                      onCheckChange={handleItemCheck}
                      onToggleOpen={handleOnToggleOpen}
                      searchTerm={debouncedSearch}
                    />
                  ))}

                  <NoMatchingResults
                    totalItems={currentItems?.length}
                    searchTerm={debouncedSearch}
                  />
                </div>
              </TabsPrimitive.Content>
            </div>
          </TabsPrimitive.Root>
        </div>

        <DialogFooter>
          <Button variant="outlined" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => dispatch({ isConfirmDialogOpen: true })}>
            Save changes
          </Button>
        </DialogFooter>
      </BaseDialog>

      <ConfirmPermissionsChangesDialog
        open={state.isConfirmDialogOpen}
        onClose={() => dispatch({ isConfirmDialogOpen: false })}
        onConfirm={handleConfirmedSubmit}
        roleName={role?.name || ""}
        changes={getPermissionChangesSummary()}
      />
    </>
  );
}

type NestedItemsProps = Omit<PermissionItemRowProps, "item"> & {
  title: string | ReactNode;
  isOpen: boolean;
  items: PermissionItem[];
  onHeaderClick: () => void;
};

function NoMatchingResults(props: { totalItems?: number; searchTerm: string }) {
  const { totalItems = 0, searchTerm } = props;

  return (
    totalItems === 0 && (
      <div className="text-center body-xs-regular text-ds-text-caption">
        {searchTerm ? (
          <div className="flex flex-col gap-2">
            <span>No matches in this tab</span>
          </div>
        ) : (
          "No items found"
        )}
      </div>
    )
  );
}

function NestedPermissionItems(props: NestedItemsProps) {
  return (
    <div className="space-y-2.5">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={props.onHeaderClick}
      >
        <Icon
          id="chevron-right"
          className={cn("size-3 transition-transform", {
            "rotate-90": props.isOpen,
          })}
        />
        <h3 className="text-xs font-bold text-ds-text-heading">{props.title}</h3>
      </div>
      <AnimatePresence>
        {props.isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3">
              {Array.isArray(props.items) &&
                props.items
                  .filter((item) => {
                    if (!props.searchTerm) return true;
                    const hasItems =
                      Array.isArray(item.widgets) || Array.isArray(item.templates);
                    if (hasItems) return true;

                    return item.name
                      .toLowerCase()
                      .includes(props.searchTerm.toLowerCase());
                  })
                  .map((item) => (
                    <PermissionItemRow
                      key={item.uuid}
                      item={item}
                      onAccessChange={props.onAccessChange}
                      onCheckChange={props.onCheckChange}
                      onToggleOpen={props.onToggleOpen}
                      searchTerm={props.searchTerm}
                    />
                  ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function synchronizeBackendPermissions(
  state: EditPermissionsState,
  backendUuid: string,
  newAccess: PermissionItem["access"],
) {
  // If setting a backend to "no-access", cascade to all related items
  // If setting to "access", only update the backend items themselves
  // (not cascading to children, as they might have individual permissions)

  // Update in data-connectors tab
  const dataConnector = state.permissionsData["data-connectors"].find(
    (item) => item.uuid === backendUuid,
  );

  if (dataConnector) {
    // Update the backend itself
    dataConnector.access = newAccess;

    // Update its widgets if they exist
    if (dataConnector.widgets && newAccess === "no-access") {
      dataConnector.widgets = dataConnector.widgets?.map((widget) => ({
        ...widget,
        access: newAccess,
      }));
    }
  }

  // Update in templates tab
  const templateBackend = state.permissionsData.templates.find(
    (item) => item.uuid === backendUuid,
  );

  if (templateBackend) {
    // Update the backend in templates tab
    templateBackend.access = newAccess;

    // Update its templates if they exist
    if (templateBackend.templates && newAccess === "no-access") {
      templateBackend.templates = templateBackend.templates?.map((template) => ({
        ...template,
        access: newAccess,
        widgets: template.widgets?.map((widget) => ({
          ...widget,
          access: newAccess,
        })),
      }));
    }
  }

  if (newAccess !== "no-access") return;

  // Update related prompts
  state.permissionsData.prompts = state.permissionsData.prompts.map((prompt) => {
    if (prompt.parentUuid === backendUuid) {
      return { ...prompt, access: newAccess };
    }
    return prompt;
  });
}

function searchResultsCb(state: EditPermissionsState): PossibleTabValues[] {
  return PERMISSION_TABS.reduce((acc, tab) => {
    const matches = state.permissionsData[tab.value].filter((item) => {
      if (!item?.name) return false;

      const nameMatch = item.name
        .toLowerCase()
        .includes(state.searchTerm.toLowerCase());

      const hasMatchingWidgets = item.widgets?.some((widget) =>
        widget?.name?.toLowerCase().includes(state.searchTerm.toLowerCase()),
      );

      const hasMatchingTemplates = item.templates?.some((template) =>
        template?.name?.toLowerCase().includes(state.searchTerm.toLowerCase()),
      );

      return nameMatch || hasMatchingWidgets || hasMatchingTemplates;
    });

    return matches.length > 0 ? acc.concat(tab.value) : acc;
  }, []);
}

function handleTemplatesAccessChange(
  item: PermissionItem,
  newState: EditPermissionsState,
  itemId: string,
  newAccess: PermissionItem["access"],
) {
  // Update the template access
  const [parentId, childId] = itemId.split(":::");
  const backendItem = newState.permissionsData["data-connectors"].find(
    (backend) => backend.uuid === parentId,
  );

  if (!backendItem) return;

  const { templates, widgets, appWidgetsIds } = item.templates.reduce(
    (acc, template) => {
      if (template.uuid === itemId) {
        template.access = newAccess;

        acc.appWidgetsIds = new Set(template.appWidgetsIds);

        acc.templates.push(template);
        return acc;
      }

      const access = template.access || "no-access";
      acc.widgets[access] = acc.widgets[access].union(new Set(template.appWidgetsIds));

      acc.templates.push(template);

      return acc;
    },
    {
      templates: [] as PermissionItem[],
      widgets: {
        access: new Set<string>(),
        "no-access": new Set<string>(),
      },
      appWidgetsIds: new Set<string>(),
    },
  );

  if (appWidgetsIds?.size > 0) {
    let diff = appWidgetsIds.difference(widgets.access);
    const someMissing = !Array.from(widgets.access.union(widgets["no-access"])).some(
      (widget) => appWidgetsIds.has(widget),
    );

    if (newAccess === "access") {
      if (someMissing) {
        widgets["no-access"] = widgets["no-access"].union(appWidgetsIds);
      }

      diff = appWidgetsIds.difference(
        widgets["no-access"].intersection(widgets.access),
      );
    }

    for (const widgetId of diff) {
      const widget = backendItem.widgets?.find((w) => w.uuid === widgetId);
      if (widget) {
        widget.access = newAccess;
      }
    }

    if (newAccess === "access") {
      if (backendItem.access !== "access") backendItem.access = newAccess;
      if (item.access !== "access") item.access = newAccess;
    }

    item.templates = templates.map((template) => ({
      ...template,
      widgets: backendItem?.widgets?.filter((w) =>
        template.appWidgetsIds?.includes(w.uuid),
      ),
    }));
  }
}
