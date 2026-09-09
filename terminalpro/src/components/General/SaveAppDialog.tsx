import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "~/components/ds/atoms/Button";
import { RadioGroup, RadioGroupItem } from "~/components/ds/atoms/RadioGroup";
import { Select } from "~/components/ds/atoms/Select";
import { DialogFooter } from "~/components/ds/dialogs/Dialog";
import type { AppTemplate } from "~/components/LayoutAuth/AppCard/types";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useShallowUserAppsStore } from "~/lib/state/userApps";
import { duplicateTabItem } from "~/lib/utils";
import Icon from "../Icon";
import { AppDialogShell } from "./AppDialog/AppDialogShell";
import {
  type AppMetadataForm,
  appMetadataObjectSchema,
  trimPrompts,
} from "./AppDialog/schema";

type DialogMode = "from-dashboard" | "edit";

export function SaveAppDialog() {
  const [subMode, setSubMode] = useState<"update" | "new">("new");
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const getDashboardById = useShallowAppStore((state) => state.getTabById);
  const addUserApp = useShallowUserAppsStore((s) => s.addUserApp);
  const editUserApp = useShallowUserAppsStore((s) => s.editUserApp);
  const getUserApp = useShallowUserAppsStore((s) => s.getUserApp);
  const userAppsMap = useShallowUserAppsStore((s) => s.userApps);

  const userApps = useMemo(
    () =>
      Object.entries(userAppsMap).map(([uuid, app]) => ({
        uuid,
        ...app.content,
      })),
    [userAppsMap],
  );

  const { dashboardId, editAppData, editAppId, closeFromDashboard, closeEdit } =
    useShallowThemeStore((state) => ({
      dashboardId: state.generateAppDashboardId,
      editAppData: state.editAppDialog.data,
      editAppId: state.editAppDialog.appId,
      closeFromDashboard: () => state.setGenerateAppDashboardId(null),
      closeEdit: () =>
        state.setEditAppDialog({ isOpen: false, appId: null, data: null }),
    }));

  const mode: DialogMode | null = dashboardId
    ? "from-dashboard"
    : editAppData
      ? "edit"
      : null;
  const isOpen = mode !== null;
  const isFromDashboard = mode === "from-dashboard";
  const isEdit = mode === "edit";

  const sourceAppId = useMemo(() => {
    if (!(isFromDashboard && dashboardId)) return null;
    const dashboard = getDashboardById(dashboardId);
    const templateId = dashboard?.data?.templateId;
    if (templateId?.startsWith("custom-")) {
      return templateId.replace("custom-", "");
    }
    return null;
  }, [isFromDashboard, dashboardId, getDashboardById]);

  const form = useForm<AppMetadataForm>({
    resolver: zodResolver(appMetadataObjectSchema),
    mode: "onSubmit",
    defaultValues: {
      name: "",
      description: "",
      imageUrl: "",
      prompts: [],
    },
  });

  const { replace } = useFieldArray({
    control: form.control,
    name: "prompts",
  });

  const dashboardName = useMemo(() => {
    if (!(isFromDashboard && dashboardId)) return "";
    const dashboard = getDashboardById(dashboardId);
    return dashboard?.data?.name || "";
  }, [isFromDashboard, dashboardId, getDashboardById]);

  /**
   * Stable identity for the data set we're editing. When this string changes
   * we re-seed the form; when it stays the same we leave the user's edits alone.
   */
  const formSignature = useMemo(() => {
    if (!isOpen) return null;
    if (isEdit) return `edit:${editAppId ?? "none"}`;
    if (isFromDashboard) {
      const target = subMode === "update" ? selectedAppId : sourceAppId;
      return `dash:${subMode}:${target ?? "none"}`;
    }
    return null;
  }, [isOpen, isEdit, isFromDashboard, editAppId, subMode, selectedAppId, sourceAppId]);

  /**
   * One-shot auto-promote: when the dashboard was already saved as a user app,
   * default the dialog to "update existing" with that app preselected.
   * Reset on close so the next open re-evaluates.
   */
  const autoPromotedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      autoPromotedRef.current = false;
      return;
    }
    if (autoPromotedRef.current) return;
    if (!isFromDashboard) return;
    if (!sourceAppId || !getUserApp(sourceAppId)) return;
    if (subMode !== "new" || selectedAppId !== null) return;
    autoPromotedRef.current = true;
    setSubMode("update");
    setSelectedAppId(sourceAppId);
  }, [isOpen, isFromDashboard, sourceAppId, subMode, selectedAppId, getUserApp]);

  useEffect(() => {
    if (formSignature === null) return;

    if (isEdit && editAppData) {
      form.reset({
        name: editAppData.name || "",
        description: editAppData.description || "",
        imageUrl: editAppData.img || "",
        prompts: [],
      });
      replace((editAppData.prompts ?? []).map((value) => ({ value })));
      return;
    }

    if (!isFromDashboard) return;

    if (subMode === "update" && selectedAppId) {
      const app = getUserApp(selectedAppId);
      if (!app) return;
      form.reset({
        name: app.name || "",
        description: app.description || "",
        imageUrl: app.img || "",
        prompts: [],
      });
      replace((app.prompts ?? []).map((value) => ({ value })));
      return;
    }

    const sourcePrompts = sourceAppId ? (getUserApp(sourceAppId)?.prompts ?? []) : [];
    form.reset({
      name: dashboardName,
      description: "",
      imageUrl: "",
      prompts: [],
    });
    replace(sourcePrompts.map((value) => ({ value })));
  }, [formSignature]);

  const handleClose = useCallback(() => {
    form.reset();
    replace([]);
    setSubMode("new");
    setSelectedAppId(null);
    if (isFromDashboard) closeFromDashboard();
    if (isEdit) closeEdit();
  }, [form, replace, isFromDashboard, isEdit, closeFromDashboard, closeEdit]);

  const handleSubmit = useCallback(
    async (data: AppMetadataForm) => {
      const promptsList = trimPrompts(data.prompts);

      const baseUpdate = {
        name: data.name.trim(),
        description: data.description.trim(),
        img: data.imageUrl?.trim() || undefined,
        prompts: promptsList,
      };

      try {
        if (isEdit && editAppId) {
          await editUserApp(editAppId, baseUpdate);
          toast.success("App updated successfully!", {
            description: `"${data.name}" has been updated.`,
          });
          handleClose();
          return;
        }

        if (!(isFromDashboard && dashboardId)) return;

        const dashboard = getDashboardById(dashboardId);
        if (!dashboard) {
          toast.error("Dashboard not found");
          return;
        }
        if (!dashboard.data?.widgets?.length) {
          toast.error("Dashboard must contain at least one widget");
          return;
        }

        if (subMode === "update" && selectedAppId) {
          const dashboardData = duplicateTabItem(dashboard);
          await editUserApp(selectedAppId, {
            ...baseUpdate,
            widgets: dashboardData.data.widgets,
            groups: dashboardData.data.groups,
            gridLayout: dashboardData.data.gridLayout || {},
          });
          toast.success("App updated successfully!", {
            description: `"${data.name}" has been updated.`,
          });
        } else {
          await addUserApp(
            dashboard,
            baseUpdate.name,
            baseUpdate.description,
            baseUpdate.img,
            promptsList.length > 0 ? promptsList : undefined,
          );
          toast.success("App created successfully!", {
            description: `"${data.name}" has been saved to your apps.`,
          });
        }

        handleClose();
      } catch (error) {
        const isUpdating = isEdit || subMode === "update";
        toast.error(isUpdating ? "Failed to update app" : "Failed to create app", {
          description:
            error instanceof Error ? error.message : "An unexpected error occurred",
        });
      }
    },
    [
      isEdit,
      isFromDashboard,
      editAppId,
      dashboardId,
      subMode,
      selectedAppId,
      getDashboardById,
      addUserApp,
      editUserApp,
      handleClose,
    ],
  );

  const handleAppSelect = useCallback((appId: string) => {
    setSelectedAppId(appId);
  }, []);

  const hasUserApps = userApps.length > 0;
  const isAlreadySaved =
    isFromDashboard && sourceAppId && userApps.some((app) => app.uuid === sourceAppId);

  const appOptions = useMemo(
    () => userApps.map((app) => ({ value: app.uuid!, label: app.name })),
    [userApps],
  );

  const previewWidgets = useMemo<AppTemplate["widgets"]>(() => {
    if (isEdit && editAppId) {
      return (getUserApp(editAppId)?.widgets ?? []) as AppTemplate["widgets"];
    }
    if (isFromDashboard && dashboardId) {
      const dashboard = getDashboardById(dashboardId);
      return (dashboard?.data?.widgets ?? []) as AppTemplate["widgets"];
    }
    return [];
  }, [isEdit, isFromDashboard, editAppId, dashboardId, getDashboardById, getUserApp]);

  const showRadio = isFromDashboard && hasUserApps;
  const submitDisabled = isFromDashboard && subMode === "update" && !selectedAppId;

  const topSlot = (
    <>
      {isAlreadySaved && (
        <div className="flex gap-2 p-3 rounded-sm bg-tag-blue-bg border border-tag-blue-label/30">
          <Icon
            id="info-circled-icon"
            className="size-4 text-alert-informative shrink-0 mt-0.5"
          />
          <div className="flex flex-col gap-0.5">
            <p className="body-xs-medium text-ds-text-heading">
              Dashboard already saved
            </p>
            <p className="body-xs-regular text-ds-text-body">
              This dashboard was saved as an app. Update the existing one or save it as
              new (note: new apps require a unique name).
            </p>
          </div>
        </div>
      )}

      {showRadio && (
        <RadioGroup
          value={subMode}
          onValueChange={(value) => {
            setSubMode(value as "update" | "new");
            if (value === "new") {
              setSelectedAppId(null);
            } else if (value === "update" && !selectedAppId && appOptions.length > 0) {
              setSelectedAppId(sourceAppId || appOptions[0].value);
            }
          }}
          className="flex flex-row flex-wrap items-center gap-x-4 gap-y-2 h-7"
        >
          <RadioGroupItem value="new" label="Save as new app" />
          <div className="flex items-center gap-2">
            <RadioGroupItem value="update" label="Update existing app" />
            {subMode === "update" && (
              <Select
                options={appOptions}
                value={selectedAppId || undefined}
                onChange={handleAppSelect}
                placeholder="Select app..."
                size="sm"
                className="min-w-[200px]"
              />
            )}
          </div>
        </RadioGroup>
      )}
    </>
  );

  const footer = (
    <DialogFooter className="pt-4">
      <Button variant="outlined" size="sm" type="button" onClick={handleClose}>
        Cancel
      </Button>
      <Button
        disabled={submitDisabled}
        loading={form.formState.isSubmitting}
        size="sm"
        type="submit"
      >
        {isEdit ? "Save Changes" : "Save"}
      </Button>
    </DialogFooter>
  );

  return (
    <AppDialogShell
      open={isOpen}
      onClose={handleClose}
      title={isEdit ? "Edit App" : "Save App from Dashboard"}
      form={form}
      onSubmit={handleSubmit}
      previewWidgets={previewWidgets}
      topSlot={topSlot}
      footer={footer}
    />
  );
}
