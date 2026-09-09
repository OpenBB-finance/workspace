import { useMutation } from "@tanstack/react-query";
import type { AxiosResponse } from "axios";
import posthog from "posthog-js";
import { toast } from "sonner";
import { apiClient } from "~/api/api";
import type { PostUploadFileResponse } from "~/api/auth.api";
import { AI_SUPPORTED_FILE_TYPES } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAuthStore } from "~/lib/state/auth";
import { type CopilotFile, useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useShallowStreamingStore } from "./useStreaming";

type ResponseT = AxiosResponse<PostUploadFileResponse>;

const MEGABYTE = 1024 * 1024;

export function updateFileStatus<T extends CopilotFile>(
  prevFiles: T[],
  filesToUpload: File[],
): T[] {
  return prevFiles.map((file) => ({
    ...file,
    status: filesToUpload.some(
      (f) => f.name === file.name && file.status !== "uploaded",
    )
      ? "failed"
      : file.status,
  }));
}

const aiCopilotAiEnhancementsFF =
  getConfig().copilot.enabled && getConfig().copilot.aiEnhancements;

async function getDescriptionsMap(
  uploadedFiles: PostUploadFileResponse,
  files: File[],
  token: string,
  aiEnhancements = false,
): Promise<Map<string, { name: string; description: string }>> {
  // Map stored_file_uuid to description
  const descriptionsMap = new Map<string, { name: string; description: string }>();
  // Generate descriptions for AI supported files
  await Promise.all(
    uploadedFiles.map(async (uploadedFile) => {
      if (
        AI_SUPPORTED_FILE_TYPES.some((type) => type === uploadedFile.extension) &&
        !uploadedFile.failed
      ) {
        const file = files.find((f) => f.name === uploadedFile.original_file_name);
        const fileInfo = {
          name: uploadedFile.original_file_name.replace(/\.[^/.]+$/, ""),
          description: uploadedFile.original_file_name,
        };

        if (file && aiEnhancements && aiCopilotAiEnhancementsFF) {
          const formData = new FormData();
          formData.append("file", file);
          try {
            const aiResponse = await fetch(
              `${getConfig().urls.ai}/v1/generate/widget_info/file`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
              },
            );
            if (aiResponse.ok) {
              const data = await aiResponse.json();
              fileInfo.name = data.title;
              fileInfo.description = data.description;
            }
          } catch (error) {
            console.error("Error fetching description for file:", file.name, error);
          }
        }
        descriptionsMap.set(uploadedFile.stored_file_uuid, fileInfo);
      }
    }),
  );
  return descriptionsMap;
}

export function useUploadDocuments() {
  const dispatch = useShallowStreamingStore((s) => s.dispatch);
  const user = useShallowAuthStore((s) => s.user);
  const selectedCopilot = useShallowCopilotStore((s) => s.selectedCopilot);
  const aiEnhancements = useShallowThemeStore((state) => state.aiEnhancements);

  const { mutateAsync: uploadDocuments } = useMutation<ResponseT, Error, File[]>({
    mutationFn: async (filesToUpload: File[]) => {
      // Need to split files into chunks of 150MB or less
      const { fileChunks } = filesToUpload.reduce(
        ({ fileChunks, chunkSize }, file) => {
          if (file.size > 25 * MEGABYTE) {
            dispatch({
              files: (prevFiles) => prevFiles.filter((f) => f.name !== file.name),
            });
            toast.error("Upload limit exceeded", {
              description: (
                <div className="grid gap-1">
                  <span>Individual files must be less than 25MB.</span>
                  <span>
                    <strong>{file.name}</strong> was not uploaded.
                  </span>
                </div>
              ),
            });

            return { fileChunks, chunkSize };
          }
          chunkSize += file.size;
          if (chunkSize > 150 * MEGABYTE) fileChunks.push([]);
          fileChunks[fileChunks.length - 1].push(file);
          return { fileChunks, chunkSize };
        },
        { fileChunks: [[] as File[]], chunkSize: 0 },
      );

      for (const files of fileChunks) {
        const formData = new FormData();
        for (const file of files) {
          formData.append("files", file);
          if (posthog) {
            posthog.capture("added_file_to_copilot", {
              file_name: file.name,
              file_size: file.size,
            });
          }
        }

        const response = await apiClient.post<PostUploadFileResponse>(
          selectedCopilot?.id === "openbb-copilot"
            ? "pro/files"
            : selectedCopilot.endpoints.upload_docs,
          formData,
          {
            headers: {
              "content-type": "multipart/form-data",
              Authorization:
                selectedCopilot?.id === "openbb-copilot"
                  ? `Bearer ${user.token}`
                  : undefined,
            },
          },
        );

        if (response?.data?.length) {
          const uploadedFiles = response.data;
          const descriptionsMap = await getDescriptionsMap(
            uploadedFiles,
            files,
            user.token,
            aiEnhancements,
          );
          dispatch({
            files: (prevFiles) =>
              prevFiles.map((prevFile) => {
                const uploadedFile = uploadedFiles.find(
                  (file) => file.original_file_name === prevFile.name,
                );
                const fileInfo = descriptionsMap.get(uploadedFile?.stored_file_uuid);
                if (uploadedFile) {
                  return {
                    ...prevFile,
                    status: uploadedFile.failed ? "failed" : "uploaded",
                    stored_file_uuid: uploadedFile.stored_file_uuid,
                    url: uploadedFile.url,
                    description: fileInfo.description,
                    name: uploadedFile.original_file_name,
                  };
                }
                return prevFile;
              }),
          });

          continue;
        }
        return response;
      }
    },

    onSuccess: (_response, filesToUpload) => {
      dispatch({
        files: (prevFiles) => updateFileStatus(prevFiles, filesToUpload),
      });
    },

    onError: (error, filesToUpload) => {
      console.error("Error uploading documents", error);
      dispatch({
        files: (prevFiles) => updateFileStatus(prevFiles, filesToUpload),
      });
    },
  });

  return uploadDocuments;
}
