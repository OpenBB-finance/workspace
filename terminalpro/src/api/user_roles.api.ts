import type { SharedPromptT } from "~/hooks/useSharedTemplates";
import type { Extension } from "~/lib/constants";
import type { Prompt } from "~/lib/state/promptLibrary";
import { apiClient } from "./api";

export interface BackendPermissionsT {
  uuid: string;
  name: string;
  access: string;
  url: string;
  endpointHeaders: { key: string; value: string; location: "headers" | "query" }[];
  widgets: { widgetId: string; access: string }[];
  templates: {
    templateId: string;
    access: string;
    description?: string;
    prompts: SharedPromptT[];
  }[];
  createdBy?: string;
}

export interface FilePermissionsT {
  uuid: string;
  access: string;
  name: string;
  description: string;
  url: string | null;
  extension: Extension;
}

export interface PromptPermissionsT {
  uuid: string;
  access: string;
  prompt: Prompt;
}

export type PermissionsT = {
  backends: BackendPermissionsT[];
  files: FilePermissionsT[];
  prompts: PromptPermissionsT[];
};

export async function getUserResourcePermissions(): Promise<PermissionsT> {
  const { data } = await apiClient
    .get<PermissionsT>("/pro/resource-permissions")
    .catch((error) => {
      console.error("API Error - getUserResourcePermissions:", error);
      return { data: { backends: [], files: [], prompts: [] } };
    });
  return data;
}
