import type { AxiosRequestConfig } from "axios";
import Papa from "papaparse";
import { useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useFormContext } from "react-hook-form";
import { apiClient } from "~/api/api";
import { deleteUploadedFile, type PostUploadFileResponse } from "~/api/auth.api";
import DragFileHere from "~/components/AI/DragFileHere";
import { Button } from "~/components/ds/atoms/Button";
import { FormMessage } from "~/components/ds/molecules/Form";
import { UploadedFile } from "~/components/General/UploadedFile";
import Icon from "~/components/Icon";
import { useStateReducer } from "~/hooks/useStateReducer";
import {
  AI_SUPPORTED_FILE_TYPES,
  type Extension,
  ExtensionOptions,
  MAX_FILE_SIZE,
  validExtension,
} from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, formatFileSize } from "~/lib/utils";
import { type FileType, useFileContext } from "../../FileContext";

export function getExtension(path: string): Extension {
  const basename = path.split(/[\\/]/).pop();
  const pos = basename.lastIndexOf(".");
  if (basename === "" || pos < 1) return "" as Extension;
  return basename.slice(pos + 1)?.toLowerCase() as Extension;
}

export function getLabel(path: string, count: string | number): string {
  if (path === "None") {
    return path;
  }
  return `${path} (${count})`;
}

const aiCopilotAiEnhancementsFF =
  getConfig().copilot.enabled && getConfig().copilot.aiEnhancements;

function UploadChildren() {
  return (
    <>
      <Icon id="download-icon" className="text-dark-100 w-5 h-5" />
      <p className="text-dark-50 my-2.5">
        <strong>Drag and Drop</strong> file(s) here
      </p>
      <p className="text-dark-50 mb-2.5">or</p>
      <Button size="sm" variant="secondary">
        Browse for file(s)
      </Button>
      <p className="mt-2.5 text-dark-100 text-2xs">
        File size limit: {formatFileSize(MAX_FILE_SIZE)}
      </p>
    </>
  );
}

export default function UploadFilesTab1({ next }: { next: () => void }) {
  const { setValue, formState } = useFormContext();
  const [state, dispatch] = useStateReducer({
    uploadProgress: null as number | null,
    message: null as string | null,
  });
  const abortControllerRef = useRef<AbortController>();

  const { files, setFiles } = useFileContext();
  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const aiEnhancements = useShallowThemeStore((state) => state.aiEnhancements);

  const prepareFiles = useCallback(
    async (acceptedFiles: File[]) => {
      const toUpload = [] as { extension: Extension; file: File }[];
      for (const file of acceptedFiles) {
        if (filesRef?.current?.some((f) => f.originalFileName === file.name)) {
          dispatch({
            uploadProgress: null,
            message: `File ${file.name} already exists`,
          });
          continue;
        }
        if (file.size > 25_000_000) {
          dispatch({
            uploadProgress: null,
            message: "File size must be less than 25MB",
          });
          continue;
        }

        const extension = getExtension(file.name);
        const valid = await checkIfValid(extension, file);
        if (valid) {
          toUpload.push({ extension, file });
        }

        setFiles((prevFiles) => {
          const fileData = {
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
          } as FileType;

          const newFiles = [...prevFiles, fileData];
          filesRef.current = newFiles;
          return newFiles;
        });
      }

      if (toUpload.length === 0) {
        return toUpload;
      }

      return toUpload;
    },
    [dispatch, setFiles, filesRef],
  );

  const user = useShallowAuthStore((s) => s.user);

  const uploadFile = useCallback(
    async (toUpload: File[]) => {
      const toUploadFileNames = toUpload.map((f) => f.name);

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

      abortControllerRef.current = new AbortController();

      for (const currFiles of splitFiles) {
        const config = {
          headers: { "content-type": "multipart/form-data" },
          signal: abortControllerRef.current.signal,
          onUploadProgress: (_progressEvent) => {
            dispatch({
              uploadProgress: (prev) => {
                const progress = Math.min(Math.max(prev || 0, 0), 100);

                return Number.isNaN(progress) ? prev : progress;
              },
            });
          },
        } as AxiosRequestConfig<FormData>;

        const formData = new FormData();
        for (const file of currFiles) {
          formData.append("files", file);
        }

        apiClient
          .post<PostUploadFileResponse>("pro/files", formData, config)
          .then(async ({ data: uploadedFiles }) => {
            for (const file of uploadedFiles) {
              setValue("extension", file.extension, { shouldValidate: true });
              setValue("url", file.url, { shouldValidate: true });
              setValue("originalFileName", file.original_file_name, {
                shouldValidate: true,
              });

              const widgeInfo = {
                name: file.original_file_name.replace(/\.[^/.]+$/, ""),
                description: file.original_file_name,
              };

              if (
                aiEnhancements &&
                aiCopilotAiEnhancementsFF &&
                AI_SUPPORTED_FILE_TYPES.some((type) => type === file.extension) &&
                !file.failed
              ) {
                const fileIndex = currFiles.findIndex(
                  (f) => f.name === file.original_file_name,
                );
                if (fileIndex !== -1) {
                  const formData = new FormData();
                  formData.append("file", currFiles[fileIndex]);
                  try {
                    const aiResponse = await fetch(
                      `${getConfig().urls.ai}/v1/generate/widget_info/file`,
                      {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${user.token}`,
                        },
                        body: formData,
                      },
                    );
                    if (aiResponse.ok) {
                      const data = await aiResponse.json();
                      widgeInfo.name = data.title;
                      widgeInfo.description = data.description;
                    }
                  } catch (error) {
                    console.error("Error:", error);
                  }
                }
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
                  name: widgeInfo.name,
                  description: widgeInfo.description,
                  status: file.failed ? "failed" : "uploaded",
                };

                const uploaded = prevFiles.filter(
                  (f) =>
                    f.status === "uploaded" &&
                    toUploadFileNames.includes(f.originalFileName),
                );
                const pending = prevFiles.filter((f) => f.status === "pending");
                const uploadProgress =
                  (uploaded.length / (uploaded.length + pending.length)) * 100;

                dispatch({
                  uploadProgress: Number.isNaN(uploadProgress)
                    ? null
                    : Math.min(uploadProgress, 100),
                });
                return prevFiles;
              });
            }
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

            dispatch({
              uploadProgress: null,
              message: "Unknown error occurred",
            });
          });
      }
    },
    [dispatch, setValue],
  );

  const checkIfValid = useCallback(
    async (extension: Extension, file: File) => {
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
        dispatch({ uploadProgress: null, message: "Unknown error occurred" });
      }

      return false;
    },
    [uploadFile, dispatch],
  );

  const errorMessage = useCallback(() => {
    const urlError = formState.errors?.url?.message.toString();
    const { message, uploadProgress } = state;
    if (message) {
      return message;
    }
    if (urlError === "This field is required") {
      if (uploadProgress === 100) {
        return undefined;
      }
      if (uploadProgress > 0) {
        return "Upload in progress";
      }
    }
    return urlError;
  }, [formState.errors, state, setValue]);

  const error = errorMessage();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    accept: {
      "text/html": [".html"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        ".docx",
      ],
      "application/pdf": [".pdf"],
      "text/csv": [".csv"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/gif": [".gif"],
      "application/json": [".json"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    onDrop: async (acceptedFiles, fileRejections) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      dispatch({ uploadProgress: null, message: null });
      const fileToLarge = fileRejections
        .filter((f) => f.errors.some((e) => e.code === "file-too-large"))
        .map((f) => f.file.name)
        .join(", ");

      if (!acceptedFiles || acceptedFiles.length === 0) {
        const message = ExtensionOptions.map((c) => `${c.toLocaleUpperCase()}`).join(
          ", ",
        );

        dispatch({
          uploadProgress: null,
          message: fileToLarge
            ? `File size must be less than 25MB: ${fileToLarge}`
            : `Only ${message} files are supported`,
        });
        setValue("url", null, { shouldValidate: true });
        return;
      }

      const toUpload = await prepareFiles(acceptedFiles);

      // check if all files are valid
      if (toUpload.length === 0) {
        dispatch({
          uploadProgress: null,
          message: fileToLarge
            ? `File size must be less than 25MB: ${fileToLarge}`
            : "No valid files selected",
        });
        return;
      }

      await uploadFile(toUpload.map((f) => f.file));

      setTimeout(() => {
        // reset the input value after upload
        const input = document.getElementById(
          "data-connector-upload",
        ) as HTMLInputElement;
        if (input) input.value = null;
      });
    },
  });

  const onRemoveClick = useCallback(
    (file: FileType) => {
      function remove() {
        setFiles((prev) => {
          const newFiles = prev.filter((f) => f.uuid !== file.uuid);

          if (newFiles.length === 0) {
            // Reset the upload progress if there are no files
            dispatch({ uploadProgress: null });
          }

          filesRef.current = newFiles;
          return newFiles;
        });
      }

      if (file.status === "failed") {
        if (filesRef?.current?.filter((f) => f.status === "failed").length === 1) {
          dispatch({ message: null });
        }
        remove();
        return;
      }

      deleteUploadedFile(file.uuid)
        .then(async ({ status }) => {
          if (status === 200) {
            remove();
          }
        })
        .catch((error) => {
          console.error("Error deleting file: ", error);
        });
    },
    [filesRef, setFiles, dispatch],
  );

  return (
    <>
      <div
        {...getRootProps()}
        className="border border-dashed dark:border-dark-300 border-light-300
        bg-white dark:bg-transparent h-[198px] w-full rounded
        flex items-center justify-center flex-col"
      >
        <input id="data-connector-upload" {...getInputProps()} />
        {isDragActive ? <DragFileHere /> : <UploadChildren />}
      </div>
      {/*
      <div
        className={cn(
          "mt-4 rounded p-2 gap-6 flex justify-between items-center text-light-900 dark:text-white",
          {
            "bg-[#FCA5A533] dark:bg-red-600/20": percentage > STORAGE_THRESHOLD * 100,
            "bg-[#66CCFF33] dark:bg-brand-main/20":
              percentage <= STORAGE_THRESHOLD * 100,
          },
        )}
      >
        <div className="flex flex-col w-full gap-3">
          <div className="flex gap-1 items-center">
            <Icon id="cloud-icon" className="w-4 h-4" />
            <span>
              Storage (
              <span
                className={cn({
                  "text-brand-main dark:text-brand-lighter":
                    percentage <= STORAGE_THRESHOLD * 100,
                  "text-red-600 dark:text-red-500":
                    percentage > STORAGE_THRESHOLD * 100,
                })}
              >
                {`${percentage}% full`}
              </span>
              )
            </span>
            <span className="text-light-500 dark:text-dark-50">
              {`${formatFileSize(
                (percentage / 100) * MAX_STORAGE_CAPACITY,
                2,
              )} of ${formatFileSize(MAX_STORAGE_CAPACITY)} used`}
            </span>
          </div>
          <Progress
            className="h-[3px]"
            value={percentage}
            indicatorClassname={cn({
              "bg-brand-main dark:bg-brand-lighter":
                percentage <= STORAGE_THRESHOLD * 100,
              "bg-red-600 dark:bg-red-500": percentage > STORAGE_THRESHOLD * 100,
            })}
          />
        </div>
        <Link to={bookingUrl}>
          <Button size="xs" variant="outlined" className="whitespace-nowrap">
            Upgrade plan
          </Button>
        </Link>
      </div>*/}
      <FormMessage
        className="text-light-700 mt-1 mb-2 dark:text-light-200 w-full p-2.5
        rounded border-[#EF4444] border dark:bg-[#4E1616] bg-red-500/10"
      >
        {error !== "Upload in progress" && error}
      </FormMessage>
      {state.uploadProgress !== null && (
        <p
          className={cn("mt-2 text-dark-50", {
            "text-red-500": error === "Upload in progress",
          })}
        >
          Upload progress: {Number.parseFloat(state.uploadProgress.toFixed(2))}%
        </p>
      )}
      <div className="overflow-y-auto scroll-auto space-y-2 relative mt-2 max-h-fit mb-2">
        {files.map((file, index) => (
          <UploadedFile
            key={index}
            status={file.status}
            name={file.originalFileName}
            onClick={() => onRemoveClick(file)}
          />
        ))}
      </div>
      <div className="mt-auto self-end">
        <Button
          className="[&_svg]:h-4"
          size="sm"
          onClick={next}
          loading={state.uploadProgress !== null && state.uploadProgress < 100}
          disabled={files.length === 0}
        >
          Continue
        </Button>
      </div>
    </>
  );
}
