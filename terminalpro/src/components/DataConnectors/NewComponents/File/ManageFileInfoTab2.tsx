import { zodResolver } from "@hookform/resolvers/zod";
import posthog from "posthog-js";
import { useCallback, useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  deleteUploadedFiles,
  getFileWidgets,
  getStoredFiles,
  type PostFileWidget,
  postFileWidget,
} from "~/api/auth.api";
import { Button } from "~/components/ds/atoms/Button";
import type { WidgetJsonT } from "~/components/types";
import { useStateReducer } from "~/hooks/useStateReducer";
import { ExtensionOptions } from "~/lib/constants";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useBackendConnectorStore } from "~/lib/state/backendConnector";
import { dispatchSaveState } from "~/lib/utils";
import { handleConnectionAdded } from "~/lib/utils/dataConnectors";
import {
  NotificationId,
  showNotification,
  showNotificationWithRememberMe,
} from "~/lib/utils/toast";
import { CATEGORY_OPTIONS } from "../../common/helpers";
import { useFileContext } from "../../FileContext";
import { FileFormElement } from "../../MultipleFileWidgetDialog";
import { useDataConnectorContext } from "../../Providers/DataConnectorContext";

const filesSchema = z.record(
  z.string(),
  z.object({
    uuid: z.string().optional(),
    name: z.string().min(1, "This field is required"),
    description: z.string().optional(),
    url: z.string().min(1, "This field is required").url(),
    originalFileName: z.string().optional(),
    dataKey: z.string().optional(),
    extension: z.enum(ExtensionOptions),
    category: z.enum(CATEGORY_OPTIONS).optional(),
    subCategory: z.string().optional(),
    source: z.string().optional(),
  }),
);

type FilesForm = z.infer<typeof filesSchema>;

type MultipleFileState = {
  loading: boolean;
  filesToUpload: FilesForm[];
};

export default function ManageFileInfoTab2({ prev }: { prev: () => void }) {
  const { isAdmin } = useShallowAuthStore((state) => ({
    isAdmin: state.user?.role === "Admin",
  }));
  const navigate = useNavigate();
  const { files, setFiles } = useFileContext();
  const dashboardId = useParams()?.id;

  const { setOpen, pendingNavigate, onWidgetAdded } = useDataConnectorContext();

  const setStoredFiles = useBackendConnectorStore()?.setStoredFiles;
  const [state, dispatch] = useStateReducer<MultipleFileState>({
    loading: false,
    filesToUpload: [],
  });

  const form = useForm<FilesForm>({
    resolver: zodResolver(filesSchema),
    defaultValues: files.reduce((acc, file, index) => {
      if (file?.status !== "uploaded") return acc;
      acc[index] = {
        uuid: file?.uuid || "",
        name: file?.name || "",
        extension: file?.extension || undefined,
        description: file?.description || "",
        url: file?.url || "",
        category: file?.category || undefined,
        subCategory: file?.subCategory || "",
        source: file?.source || "",
        dataKey: "",
        originalFileName: file?.originalFileName || undefined,
      };
      return acc;
    }, {} as FilesForm),
  });

  useEffect(() => {
    const uploadFiles = files.filter((file) => file?.status === "uploaded");
    if (uploadFiles.length === 0) return prev();
  }, [files]);

  const handleSubmit = useCallback(
    async (values: FilesForm) => {
      const widgetsList = [] as WidgetJsonT[];
      dispatch({ loading: true });
      let uploadStatus = 200;
      for (const file of Object.values(values)) {
        const dataKey = file?.dataKey !== "None" ? file?.dataKey || "" : "";
        const finalId = uuidv4();

        const cleanData: PostFileWidget = {
          stored_file_uuid: file.uuid,
          originalFileName: file.originalFileName,
          url: file.url,
          extension: file.extension,
          name: file.name,
          description: file.description,
          category: file.category,
          subCategory: file.subCategory,
          source: file.source,
          dataKey,
        };
        const { status } = await postFileWidget(finalId, cleanData).catch((error) => {
          console.error("Error uploading file: ", error);
          return { status: 500 };
        });
        if (status !== 200) {
          toast.error("Something went wrong. Please try again.", {
            description: "Unknown error occurred",
          });
          dispatch({ loading: false });
          return;
        }
        uploadStatus = status;

        const widgetToAdd = {
          id: finalId,
          endpoint: file.url,
          type: "table" as const,
          external: true,
          category: file.category ?? "Others",
          subCategory: file.subCategory,
          widgetId: `file-${finalId}` as const,
          dataKey,
          description: file.description,
          name: file.name,
          gridData: { w: 20, h: file.extension === "pdf" ? 20 : 10 },
          data: {
            dataKey,
            table: { enableCharts: true },
          },
          source: file.source,
          connectionType: "file" as const,
        };
        widgetsList.push(widgetToAdd); // Append widgetToAdd to the widgetsList
        dispatchSaveState();
      }

      const fileWidgets = await getFileWidgets();
      setStoredFiles(fileWidgets);

      setOpen(false);
      onWidgetAdded?.();

      handleConnectionAdded(dashboardId, widgetsList, pendingNavigate);

      if (isAdmin && uploadStatus === 200) {
        showNotificationWithRememberMe({
          id: NotificationId.ConfigureFilePermissions,
          message: "Configure file permissions",
          description:
            "Your file(s) were successfully uploaded! You can now configure permissions for your Organization in the Admin Portal.",
          toastType: "info",
          action: {
            label: "Go to Admin Portal",
            onClick: () => {
              navigate("/admin/roles");
            },
          },
        });
      }
      if (posthog) {
        const storedFiles = await getStoredFiles();
        for (const widget of widgetsList) {
          const file = storedFiles.find((file) => file.file_widget_uuid === widget.id);

          posthog.capture("uploaded_file", {
            file_name: widget.name,
            file_description: widget.description,
            file_type: file?.extension,
            file_size: file?.size,
          });
        }
      }
    },
    [setStoredFiles, pendingNavigate],
  );

  const handleClose = useCallback(() => {
    if (files.length > 0) {
      showNotification({
        message: "Lose uploaded files",
        description:
          "Uploaded files will be lost if you close this dialog. Do you wish to continue?",
        toastType: "warning",
        cancel: {
          label: "Cancel",
          onClick: () => {},
        },
        action: {
          label: "Yes, forget uploaded files.",
          onClick: () => {
            deleteUploadedFiles(files.map((file) => file.uuid))
              .then(async () => {
                prev();
              })
              .catch((error) => {
                console.error("Error deleting file: ", error);
              });
          },
        },
      });
    } else {
      //setSearchParams({ tab });
    }
  }, [files]);

  useEffect(() => {
    return () => {
      dispatch({ loading: false });
      setFiles([]);
    };
  }, [setFiles]);

  return (
    <FormProvider {...form}>
      <div className="flex-col overflow-y-auto z-30" key="single-file-dialog">
        {files.map((file, index) => (
          <div key={`${file?.originalFileName}_${index}`} className="relative z-30">
            <FileFormElement
              key={file.originalFileName}
              fileIndex={index}
              file={file}
              handleSubmit={handleSubmit}
            />
          </div>
        ))}
      </div>
      <div className="mt-auto self-end flex gap-2">
        <Button size="sm" variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          className="[&_svg]:h-4"
          size="sm"
          loading={state.loading}
          type="submit"
          onClick={() => {
            handleSubmit(form.getValues());
          }}
        >
          Upload
        </Button>
      </div>
    </FormProvider>
  );
}
