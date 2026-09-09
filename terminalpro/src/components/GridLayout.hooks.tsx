import type { AxiosRequestConfig } from "axios";
import Papa from "papaparse";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { apiClient } from "~/api/api";
import {
  getFileWidgets,
  type PostFileWidget,
  type PostUploadFileResponse,
  postFileWidget,
} from "~/api/auth.api";
import useIsMobile from "~/hooks/useIsMobile";
import {
  AI_SUPPORTED_FILE_TYPES,
  type Extension,
  ExtensionOptions,
  MAX_FILE_SIZE,
  validExtension,
} from "~/lib/constants";
import { useTabContext } from "~/lib/contexts/TabContext";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useShallowThemeStore } from "~/lib/state/theme";
import { uuidv4 } from "~/lib/utils";
import { useFileContext } from "./DataConnectors/FileContext";
import { getExtension } from "./DataConnectors/NewComponents/File/UploadFilesTab1";
import { Button } from "./ds/atoms/Button";
import { BaseDialog } from "./ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "./ds/dialogs/Dialog";
import Icon from "./Icon";
import LoadingSpinnerIcon from "./Icons/LoadingSpinner";
import type { WidgetJsonT } from "./types";

const aiCopilotAiEnhancementsFF =
  getConfig().copilot.enabled && getConfig().copilot.aiEnhancements;

export function useDragAndDropFiles(locked: boolean) {
  const { id } = useParams();
  const isMobile = useIsMobile();
  const { isShared } = useTabContext();
  const { files, setFiles } = useFileContext();

  const user = useShallowAuthStore((state) => state.user);
  const addWidget = useShallowAppStore((state) => state.addWidget);
  const aiEnhancements = useShallowThemeStore((state) => state.aiEnhancements);

  const setStoredFiles = useShallowBackendConnectorStore(
    (state) => state.setStoredFiles,
  );

  const uploadFiles = useCallback(
    async (toUpload: File[], abortController?: AbortController, test = false) => {
      if (test) {
        return new Promise((_resolve, reject) => {
          const interval = setInterval(() => {
            if (abortController?.signal.aborted) {
              clearInterval(interval);
              setFiles([]);
              reject("Upload aborted");
            }
          }, 1000);
        });
      }

      const { splitFiles } = toUpload.reduce(
        ({ splitFiles, currentTotal }, file) => {
          currentTotal += file.size;
          if (currentTotal > 150 * 1024 * 1024) {
            splitFiles.push([]);
            currentTotal = file.size;
          }

          splitFiles[splitFiles.length - 1].push(file);
          return { splitFiles, currentTotal };
        },
        { splitFiles: [[] as File[]], currentTotal: 0 },
      );

      const successfulFiles = [] as { success: boolean }[];

      for (const files of splitFiles) {
        const config = {
          headers: { "content-type": "multipart/form-data" },
          signal: abortController?.signal,
        } as AxiosRequestConfig<FormData>;

        const formData = new FormData();
        for (const file of files) {
          formData.append("files", file);
        }

        const res = await apiClient
          .post<PostUploadFileResponse>("pro/files", formData, config)
          .then(async ({ data: uploadedFiles }) => {
            for (const file of uploadedFiles) {
              const widgetInfo = {
                name: file.original_file_name.replace(/\.[^/.]+$/, ""),
                description: file.original_file_name,
              };

              if (
                aiEnhancements &&
                aiCopilotAiEnhancementsFF &&
                AI_SUPPORTED_FILE_TYPES.some((type) => type === file.extension) &&
                !file.failed
              ) {
                const fileIndex = files.findIndex(
                  (f) => f.name === file.original_file_name,
                );
                if (fileIndex !== -1) {
                  const formData = new FormData();
                  formData.append("file", files[fileIndex]);
                  try {
                    const aiResponse = await fetch(
                      `${getConfig().urls.ai}/v1/generate/widget_info/file`,
                      {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${user?.token}`,
                        },
                        body: formData,
                        signal: abortController?.signal,
                      },
                    );
                    if (aiResponse.ok) {
                      const data = await aiResponse.json();
                      widgetInfo.name = data.title;
                      widgetInfo.description = data.description;
                    }
                  } catch (error) {
                    console.error("Error:", error);
                  }
                }
              }

              const finalId = uuidv4();
              const cleanData: PostFileWidget = {
                stored_file_uuid: file.stored_file_uuid,
                originalFileName: file.original_file_name,
                url: file.url,
                extension: file.extension as Extension,
                name: widgetInfo.name,
                description: widgetInfo.description,
                category: "Others",
                subCategory: "",
                source: "",
                dataKey: "",
              };

              try {
                const { status } = await postFileWidget(
                  finalId,
                  cleanData,
                  abortController.signal,
                );
                if (status !== 200) {
                  console.error("Error posting file widget metadata");
                  continue;
                }
              } catch (error) {
                console.error("Error posting file widget metadata:", error);
                continue;
              }

              setFiles((prevFiles) => {
                const fileIndex = prevFiles.findIndex(
                  (f) => f.originalFileName === file.original_file_name,
                );
                if (fileIndex === -1) return prevFiles;

                prevFiles[fileIndex] = {
                  ...prevFiles[fileIndex],
                  uuid: file.stored_file_uuid,
                  url: file.url,
                  name: widgetInfo.name,
                  description: widgetInfo.description,
                  status: file.failed ? "failed" : "uploaded",
                };

                return prevFiles;
              });

              const widgetToAdd = {
                id: finalId,
                endpoint: file.url,
                type: "table" as const,
                external: true,
                category: "Others",
                subCategory: "",
                widgetId: `file-${finalId}` as const,
                dataKey: "",
                description: widgetInfo.description,
                name: widgetInfo.name,
                gridData: { w: 20, h: file.extension === "pdf" ? 20 : 10 },
                data: {
                  dataKey: "",
                  table: { enableCharts: true },
                },
                source: "",
                connectionType: "file" as const,
              } as WidgetJsonT;

              await addWidget(id, widgetToAdd);
            }

            return { success: true };
          })
          .catch((error) => {
            if (error.message !== "canceled") {
              console.error("Error uploading files: ", error);
            }
            setFiles((prevFiles) => {
              for (const file of toUpload) {
                const fileIndex = prevFiles.findIndex(
                  (f) => f.originalFileName === file.name,
                );
                if (fileIndex === -1) return prevFiles;

                const status = prevFiles[fileIndex].status;
                prevFiles[fileIndex] = {
                  ...prevFiles[fileIndex],
                  status: status === "pending" ? "failed" : status,
                };
              }
              return prevFiles;
            });

            return { success: false };
          });

        successfulFiles.push(res);
      }

      return new Promise((resolve, reject) => {
        if (abortController?.signal.aborted) {
          reject("Upload aborted");
        } else if (successfulFiles.some((f) => !f.success)) {
          reject("Error uploading files");
        } else {
          resolve("Files uploaded successfully");
        }
      }).finally(async () => {
        const fileWidgets = await getFileWidgets();
        setStoredFiles(fileWidgets);
        setFiles([]);
      });
    },
    [user?.token, id, setFiles, addWidget, aiEnhancements, setStoredFiles],
  );

  const toastUpload = useCallback(
    (toUpload: { extension: Extension; file: File }[]) => {
      const abortController = new AbortController();
      const multipleFiles = toUpload.length > 1;

      toast.promise(
        uploadFiles(
          toUpload.map((f) => f.file),
          abortController,
        ),
        {
          closeButton: false,
          id: "drag-and-drop-files",
          loading: (
            <div className="flex flex-col gap-2">
              <strong className="inline-flex items-center gap-2">
                <LoadingSpinnerIcon
                  strokeWidth={1.5}
                  className="h-[14px] w-[14px] animate-spin fill-ds-text-caption"
                />
                Uploading files...
              </strong>
              <p className="mt-2">
                You can update the name and edit the metadata later, either directly
                within the widget or in the{" "}
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  to="/app/widgets"
                  className="obb-hyper-link"
                >
                  Widgets Library
                </Link>{" "}
                page.
              </p>
              <div className="mt-2 flex gap-1.5 self-end">
                <AbortUploads
                  onAbort={() => abortController.abort("Upload aborted")}
                  isMultiple={multipleFiles}
                />
              </div>
            </div>
          ),
          success: (
            <>
              <strong>Files uploaded successfully</strong>
              <p className="mt-2">
                You can update the name and edit the metadata later, either directly
                within the widget or in the{" "}
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  to="/app/widgets"
                  className="obb-hyper-link"
                >
                  Widgets Library
                </Link>{" "}
                page.
              </p>
            </>
          ),
          error: (error) => {
            if (error === "Upload aborted") {
              return multipleFiles ? (
                <div className="flex flex-col">
                  <strong>Upload aborted</strong>
                  <p className="mt-1">All pending uploads have been aborted.</p>
                </div>
              ) : (
                "Upload aborted"
              );
            }

            return "Error uploading files";
          },
        },
      );
    },
    [uploadFiles],
  );

  const checkIfValid = useCallback(async (extension: Extension, file: File) => {
    try {
      if (extension === "csv") {
        return new Promise<boolean>((resolve, reject) => {
          const config = {
            complete: () => resolve(true),
            error: () => reject(false),
            header: true,
          } as Papa.ParseLocalConfig;

          Papa.parse(file, config);
        });
      }
      if (extension === "json") {
        const data = await file.text();
        JSON.parse(data);
      }

      return validExtension(extension);
    } catch (e) {
      console.error(e);
      toast.error("Unknown error occurred");
    }

    return false;
  }, []);

  const prepareFiles = useCallback(
    async (acceptedFiles: File[]) => {
      const toUpload = [] as { extension: Extension; file: File }[];
      const existingFiles = [];
      for (const file of acceptedFiles) {
        if (
          files.some((f) => f.originalFileName === file.name && f.status !== "failed")
        ) {
          existingFiles.push(file.name);
          continue;
        }
        if (file.size > 25_000_000) {
          toast.error("Invalid file(s)", {
            description: `File size must be less than 25MB: ${file.name}`,
            id: "drag-and-drop-files-invalid",
          });
          continue;
        }

        const extension = getExtension(file.name);
        const valid = await checkIfValid(extension, file);
        if (valid) {
          toUpload.push({ extension, file });
        }

        setFiles((prevFiles) => [
          ...prevFiles,
          {
            uuid: "",
            originalFileName: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            webkitRelativePath: file.webkitRelativePath,
            extension,
            url: "",
            name: file.name,
            description: file.name,
            source: "",
            category: "Others",
            subCategory: "",
            status: valid ? "pending" : "failed",
          },
        ]);
      }

      if (existingFiles.length > 0) {
        toast.error("File(s) already uploaded", {
          id: "drag-and-drop-files-invalid",
          duration: 2000,
          description: (
            <div className="flex flex-col gap-2">
              <p>File(s) already uploaded:</p>
              <ul className="list-inside list-disc">
                {existingFiles.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </div>
          ),
        });
      }

      return toUpload;
    },
    [setFiles, files, checkIfValid],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        ".docx",
      ],
      "text/html": [".html"],
      "text/csv": [".csv"],
      "application/json": [".json"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/gif": [".gif"],
    },
    onDrop: async (acceptedFiles, fileRejections) => {
      const fileToLarge = fileRejections
        .filter((f) => f.errors.some((e) => e.code === "file-too-large"))
        .map((f) => f.file.name)
        .join(", ");

      if (!acceptedFiles || acceptedFiles.length === 0) {
        const message = ExtensionOptions.map((c) => `${c.toLocaleUpperCase()}`).join(
          ", ",
        );

        toast.error("Invalid file(s)", {
          id: "drag-and-drop-files-invalid",
          description: fileToLarge
            ? `File size must be less than 25MB: ${fileToLarge}`
            : `Only ${message} files are supported`,
          duration: 2000,
        });
        return;
      }

      const toUpload = await prepareFiles(acceptedFiles);

      // check if all files are valid
      if (toUpload.length === 0) {
        return toast.error("Invalid file(s)", {
          description: fileToLarge
            ? `File size must be less than 25MB: ${fileToLarge}`
            : "No valid files detected",
          id: "drag-and-drop-files-invalid",
        });
      }

      if (toUpload.length > 10) {
        return toast.warning("Multiple files detected", {
          id: "drag-and-drop-files-folder",
          dismissible: false,
          closeButton: false,
          action: (
            <MultiFilesDialog
              isOpen={true}
              onClose={() => {
                setFiles([]);
                toast.dismiss("drag-and-drop-files-folder");
              }}
              onAccept={() => {
                toastUpload(toUpload);
                toast.dismiss("drag-and-drop-files-folder");
              }}
              totalFiles={toUpload.length}
            />
          ),
        });
      }

      return toastUpload(toUpload);
    },
    noClick: true,
    disabled: locked || isShared || isMobile,
  });

  return { getRootProps, getInputProps, isDragActive };
}

function AbortUploads(props: { onAbort: () => void; isMultiple: boolean }) {
  const { onAbort, isMultiple } = props;
  const [isOpen, setIsOpen] = useState(false);

  const onAbortClick = () => {
    setIsOpen(false);
    onAbort();
  };

  return (
    <>
      <Button
        type="button"
        size="xs"
        onClick={() => {
          if (isMultiple) return setIsOpen(true);

          onAbort();
        }}
      >
        Cancel
      </Button>
      <AbortWarning
        onAccept={onAbortClick}
        onClose={() => setIsOpen(false)}
        isOpen={isOpen}
      />
    </>
  );
}

type DialogProps = {
  onAccept: () => void;
  onClose: () => void;
  isOpen: boolean;
};

function AbortWarning(props: DialogProps) {
  const { onAccept, onClose, isOpen } = props;

  return (
    <BaseDialog open={isOpen} onClose={onClose} modal={true} focusOnOpen={false}>
      <DialogTitle>
        <span className="flex">
          <Icon id="warning-icon" className="text-[#F97316] size-5 mr-2" /> Cancel
          uploading process
        </span>
      </DialogTitle>
      <p>
        Are you sure you want to continue? Pending files will be aborted, but the
        uploaded files will remain.
      </p>
      <DialogFooter>
        <Button size="sm" variant="outlined" onClick={onClose}>
          No, Continue
        </Button>
        <Button onClick={onAccept} size="sm">
          Yes, Cancel
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}

function MultiFilesDialog(props: DialogProps & { totalFiles: number }) {
  const { onAccept, onClose, isOpen, totalFiles } = props;
  const [isOpenDialog, setIsOpenDialog] = useState(isOpen);

  const onContinue = () => {
    setIsOpenDialog(false);
    onAccept();
  };

  const onCanceled = () => {
    setIsOpenDialog(false);
    onClose();
  };

  return (
    <BaseDialog
      open={isOpenDialog}
      onClose={onCanceled}
      modal={true}
      focusOnOpen={false}
    >
      <DialogTitle>Confirm files upload</DialogTitle>
      <p>
        Are you sure you want to upload {totalFiles} files to the dashboard? This action
        may take some time, depending on the size and number of files.
      </p>
      <DialogFooter>
        <Button size="sm" variant="outlined" onClick={onCanceled}>
          Cancel
        </Button>
        <Button onClick={onContinue} size="sm">
          Yes, Continue
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}
