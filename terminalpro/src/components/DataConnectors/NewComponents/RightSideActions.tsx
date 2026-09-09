import capitalize from "lodash/capitalize";
import { type MouseEvent, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { getStoredFileBlob } from "~/api/auth.api";
import { Button } from "~/components/ds/atoms/Button";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useStateReducer } from "~/hooks/useStateReducer";
import { getTypeToUse } from "~/lib/contexts/MyDataConnectorsContext";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { handleWidgetDeletion } from "~/lib/utils";
import { ConfirmDialog } from "../../ds/dialogs/ConfirmDialog";
import { updateWidgetEndpoints } from "../common/helpers";
import {
  type DcTabT,
  useDataConnectorContext,
} from "../Providers/DataConnectorContext";
import ConfirmDeleteBackendDialog from "./ConfirmDeleteBackendDialog";
import { SourceMeta } from "./types";

interface RightSideActionsProps {
  id: string;
  type: string;
  disabled?: boolean;
  parentId?: string;
  parentType?: string;
  selectionId?: string;
  name?: string;
  /** Stored-file endpoint URL (file rows only); fetched through the authed client to download. */
  fileUrl?: string;
  /** Original uploaded file name (file rows only); used as the saved download name. */
  originalFileName?: string;
}

const getTypeTitle = (type: string) => {
  if (["backend", "file"].includes(type)) return capitalize(type);

  return "Widget";
};

export const RightSideActions = ({
  id,
  type,
  parentId,
  parentType,
  selectionId,
  name,
  fileUrl,
  originalFileName,
  disabled = false,
}: RightSideActionsProps) => {
  const [state, dispatch] = useStateReducer(null, () => ({
    isDeleting: false,
    isDownloading: false,
    showDeleteDialog: false,
    deleteConfirmOpen: false,
  }));
  const showEdit = SourceMeta[type]?.showEdit ?? true;
  const { setOpen } = useDataConnectorContext();
  const backendConnector = useShallowBackendConnectorStore((s) => ({
    setSingleWidgets: s.setSingleWidgets,
    updateApiSources: s.updateApiSources,
    setStoredFiles: s.setStoredFiles,
    setWidgetMetadata: s.setWidgetMetadata,
    getApiSourceById: s.getApiSourceById,
    updateApiSource: s.updateApiSource,
    isLoadingBackends: s.isLoadingBackends,
  }));
  const typeTitle = getTypeTitle(type);

  const { removeWidget, getWidgetsByAttribute } = useShallowAppStore((s) => ({
    removeWidget: s.removeWidget,
    getWidgetsByAttribute: s.getWidgetsByAttribute,
  }));
  const deleteWidgets = useCallback(
    (key: string) => {
      const selectedWidgets = getWidgetsByAttribute("widgetId", key);
      for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
        for (const widget of widgets) {
          removeWidget(dashId, widget.id);
        }
      }
    },
    [getWidgetsByAttribute, removeWidget],
  );

  const backendName = useMemo(() => {
    return type === "backend" ? backendConnector.getApiSourceById(id)?.name : name;
  }, [type, id, name, backendConnector]);

  const handleDeleteConfirmation = useCallback(async () => {
    const typeToRemove = getTypeToUse(type, selectionId, parentType);
    const deleteTitle = typeTitle === "Widget" ? "Widget(s)" : typeTitle;
    const deleteText = deleteTitle.toLowerCase();

    try {
      dispatch({ isDeleting: true });
      await handleWidgetDeletion({
        type: typeToRemove,
        id,
        backendConnector,
        deleteWidgets,
      });

      toast.success(
        <>
          <strong>{deleteTitle} successfully deleted</strong>
          <p className="mt-2">
            {deleteTitle} successfully deleted and removed from all dashboards where it
            was used.
          </p>
        </>,
      );
    } catch (error) {
      toast.error(`Failed to delete ${deleteText}`);
    } finally {
      dispatch({ isDeleting: false, deleteConfirmOpen: false });
    }
  }, [type, parentType, selectionId, typeTitle, id, backendConnector, deleteWidgets]);

  const onDelete = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();

      const typeToRemove = type === "others" ? parentType : type;

      if (typeToRemove === "backend") {
        return dispatch({ showDeleteDialog: true });
      }

      dispatch({ deleteConfirmOpen: true });
    },
    [type, parentType],
  );

  const onDownload = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      if (!fileUrl) {
        toast.error("Failed to download file");
        return;
      }
      dispatch({ isDownloading: true });
      try {
        // Fetch through the authed client (the file endpoint is on the API origin,
        // unlike the S3 presigned URL the AI flow uses). The resulting blob is
        // same-origin, so the download attribute names the file correctly.
        const blob = await getStoredFileBlob(fileUrl);
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = originalFileName || name || "download";
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
      } catch {
        toast.error("Failed to download file");
      } finally {
        dispatch({ isDownloading: false });
      }
    },
    [fileUrl, originalFileName, name],
  );

  const onEdit = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      const typeToEdit = type === "others" ? parentType : type;
      e.preventDefault();
      e.stopPropagation();
      setOpen(true, {
        mode: "edit",
        dcTab:
          typeToEdit === "websites"
            ? "website"
            : typeToEdit === "rss_feeds"
              ? "rss"
              : (typeToEdit as DcTabT),
        id,
      });
    },
    [id, type, parentId, parentType, setOpen],
  );

  return (
    <>
      <div className="flex gap-2 items-center">
        {type === "file" && (
          <Tooltip position="top" message="Download File">
            <Button
              size="xs"
              variant="ghost"
              className="size-6 obb-small-navbar-btn p-1"
              onClick={onDownload}
              disabled={disabled || state.isDownloading}
              loading={state.isDownloading}
              loadingChildren={null}
              {...(name && { "data-testid": `download-${name}` })}
            >
              <Icon id="download" className="size-3.5" />
            </Button>
          </Tooltip>
        )}
        <Tooltip position="top" message={`Delete ${typeTitle}`}>
          <Button
            size="xs"
            variant="ghost"
            className="size-6 obb-small-navbar-btn p-1"
            onClick={onDelete}
            disabled={disabled}
            {...(name && { "data-testid": `delete-${name}` })}
          >
            <Icon id="trash-04" className="size-3.5" />
          </Button>
        </Tooltip>
        {showEdit && (
          <Tooltip position="top" message="Edit">
            <Button
              size="xs"
              variant="ghost"
              className="size-6 obb-small-navbar-btn p-1"
              onClick={onEdit}
              disabled={disabled}
            >
              <Icon id="pencil-02" className="size-3.5" />
            </Button>
          </Tooltip>
        )}
        {type === "backend" && (
          <Tooltip position="top" message="Refresh connection">
            <Button
              size="xs"
              variant="ghost"
              className="size-6 obb-small-navbar-btn p-1"
              disabled={disabled}
              onClick={async (e) => {
                e.stopPropagation();
                const source = backendConnector.getApiSourceById(id);

                if (source) {
                  const { widgets, errorMessage } =
                    await backendConnector.updateApiSource(source);

                  if (errorMessage)
                    return toast.error(`Error: ${source.name}`, {
                      description: errorMessage,
                    });

                  updateWidgetEndpoints({ ...source, widgets });

                  toast.success("Widgets updated");
                }
              }}
            >
              <Icon id="refresh-right" className="size-3.5" />
            </Button>
          </Tooltip>
        )}
      </div>
      <ConfirmDialog
        open={state.deleteConfirmOpen}
        onClose={() => dispatch({ deleteConfirmOpen: false })}
        title={`Delete ${typeTitle}`}
        description={
          <>
            <span className="block">
              Are you sure you want to delete this {typeTitle.toLowerCase()}? This will
              remove the widget(s) from all dashboards where it was used.
            </span>
            <span className="block text-light-600 dark:text-dark-50 text-xs mt-3">
              This action cannot be undone.
            </span>
          </>
        }
        confirmButton={
          <Button
            variant="danger"
            size="sm"
            onClick={handleDeleteConfirmation}
            loading={state.isDeleting}
            disabled={state.isDeleting}
          >
            Yes, Delete
          </Button>
        }
        cancelText="Cancel"
      />
      <ConfirmDeleteBackendDialog
        open={state.showDeleteDialog}
        onClose={() => dispatch({ showDeleteDialog: false })}
        name={backendName ?? ""}
        onConfirm={handleDeleteConfirmation}
      />
    </>
  );
};
