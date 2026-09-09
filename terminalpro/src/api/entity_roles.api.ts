import type {
  ActivityLogEntry,
  RoleAuditLogReturn,
  RoleT,
} from "~/components/AdminRoles/types";
import { apiClient } from "./api";

interface SuccessResponse {
  success: boolean;
}
interface EntityRoleResponse {
  uuid: string;
  name: string;
  description: string;
  users: string[];
  updated_date: string;
}

export interface EntityRolePermissions {
  uuid: string;
  access: "access" | "no-access";
  category: string;
  type: string;
  widgets?: {
    widgetId: string;
    access: "access" | "no-access";
  }[];
  templates?: {
    templateId: string;
    access: "access" | "no-access";
    prompts?: {
      promptId: string;
      access: "access" | "no-access";
    }[];
  }[];
  file_extension: string | null;
}

export async function getEntityRoles(): Promise<RoleT[]> {
  const { data } = await apiClient.get<EntityRoleResponse[]>("/admin/role");
  return data.map((role) => {
    const { updated_date, ...rest } = role;
    return {
      ...rest,
      createdAt: new Date(updated_date).getTime(),
    };
  });
}
export async function postEntityRole(role: RoleT) {
  const { createdAt, ...roleWithoutCreatedAt } = role;
  const { data } = await apiClient.post<SuccessResponse>(
    "/admin/role",
    roleWithoutCreatedAt,
  );
  return data;
}
export async function patchEntityRole(role: RoleT) {
  const { createdAt, uuid, ...adjustedRole } = role;
  const { data } = await apiClient.patch<SuccessResponse>(
    `/admin/role/${uuid}`,
    adjustedRole,
  );
  return data;
}
export async function deleteEntityRole(uuid: string) {
  const { data } = await apiClient.delete<SuccessResponse>(`/admin/role/${uuid}`);
  return data;
}
export async function getEntityRolePermissions(uuid: string) {
  const { data } = await apiClient.get<EntityRolePermissions[]>(
    `/admin/role-permissions/${uuid}`,
  );

  // Group file permissions by category
  const filePermissions = data
    .filter((p) => p.type === "file")
    .reduce(
      (acc, curr) => {
        const key = curr.file_extension;
        if (!acc[key]) {
          acc[key] = {
            uuid: curr.file_extension,
            access: curr.access,
            category: curr.category,
            type: "file",
            file_extension: curr.file_extension,
            widgets: [],
          };
        }
        acc[key].widgets?.push({
          widgetId: curr.uuid,
          access: curr.access,
        });
        return acc;
      },
      {} as Record<string, EntityRolePermissions>,
    );

  return [...Object.values(filePermissions), ...data.filter((p) => p.type !== "file")];
}
export async function putEntityRolePermissions(
  uuid: string,
  permissions: EntityRolePermissions[],
) {
  // First, handle prompt type permissions consolidation
  const consolidatedPermissions = permissions.reduce((acc, permission) => {
    if (permission.type === "prompt" && permission.templates) {
      // Find existing prompt permission with same UUID and category
      const existingPermIndex = acc.findIndex(
        (p) =>
          p.uuid === permission.uuid &&
          p.type === "prompt" &&
          p.category === permission.category,
      );

      if (existingPermIndex === -1) {
        // If not found, add as is
        acc.push({
          ...permission,
          access: permission.access || "no-access", // Ensure access property exists
        });
      } else {
        // If found, merge templates
        const existing = acc[existingPermIndex];
        if (existing.templates) {
          permission.templates.forEach((newTemplate) => {
            const existingTemplateIndex = existing.templates!.findIndex(
              (t) => t.templateId === newTemplate.templateId,
            );

            if (existingTemplateIndex === -1) {
              // If template doesn't exist, add it with access property
              existing.templates!.push({
                ...newTemplate,
                access: newTemplate.access || "no-access",
              });
            } else {
              // Merge prompts within template
              const existingTemplate = existing.templates![existingTemplateIndex];

              // Ensure access property exists on template
              existingTemplate.access = existingTemplate.access || "no-access";

              // Ensure both have prompts arrays before merging
              if (!existingTemplate.prompts) existingTemplate.prompts = [];
              if (newTemplate.prompts) {
                // Add prompts that don't already exist
                newTemplate.prompts.forEach((newPrompt) => {
                  const promptExists = existingTemplate.prompts!.some(
                    (p) => p.promptId === newPrompt.promptId,
                  );

                  if (!promptExists) {
                    existingTemplate.prompts!.push({
                      ...newPrompt,
                      access: newPrompt.access || "no-access", // Ensure access property exists
                    });
                  }
                });
              }
            }
          });
        } else if (permission.templates) {
          // If existing has no templates but new permission does
          existing.templates = permission.templates.map((template) => ({
            ...template,
            access: template.access || "no-access",
            prompts: template.prompts?.map((prompt) => ({
              ...prompt,
              access: prompt.access || "no-access",
            })),
          }));
        }

        // Ensure access property exists on the permission itself
        existing.access = existing.access || "no-access";
      }
      return acc;
    }

    // For non-prompt types or those without templates
    // Check if we already have this permission (by UUID, type and category)
    const existingIndex = acc.findIndex(
      (p) =>
        p.uuid === permission.uuid &&
        p.type === permission.type &&
        p.category === permission.category,
    );

    if (existingIndex === -1) {
      // If not found, add as is with access property
      acc.push({
        ...permission,
        access: permission.access || "no-access",
      });
    }
    // If found with same UUID/type/category, we keep the existing one
    // (This prevents duplicates for non-prompt permissions)

    return acc;
  }, [] as EntityRolePermissions[]);

  // Then handle file permissions flattening as before
  const flattenedPermissions = consolidatedPermissions.flatMap((permission) => {
    if (permission.type === "file" && permission.widgets) {
      return permission.widgets.map((widget) => ({
        uuid: widget.widgetId,
        access: widget.access,
        category: permission.category,
        type: permission.type,
      }));
    }
    return permission;
  });

  const { data } = await apiClient.put<SuccessResponse>(
    `/admin/role-permissions/${uuid}`,
    flattenedPermissions,
  );
  return data;
}

export async function getEntityRoleActivityLog() {
  const { data } = await apiClient.get<RoleAuditLogReturn[]>(
    "admin/role-permissions-audit-logs",
  );

  // transform the data to ActivityLogEntry
  const activityLog = data.map((log) => {
    const activityType = `${log.action.charAt(0).toUpperCase()}${log.action.slice(1)} ${log.resource_type}`;
    return {
      uuid: log.uuid,
      role: log.role_name,
      performedBy: log.performed_by_email,
      activityType,
      timestamp: new Date(log.created_at).getTime(), // Convert to number timestamp
      detailsMsg: log.details_msg ?? "", // Ensure string
      details: log.details,
    } satisfies ActivityLogEntry;
  });

  return activityLog;
}

type UserPermissions = {
  data_connectors: Record<string, any>[];
  templates: Record<string, any>[];
  prompts: Record<string, any>[];
};

type UserPermissionsResponse = UserPermissions | UserPermissions[];

export async function getUserPermissions(userUuid: string) {
  const { data } = await apiClient.get<UserPermissionsResponse>(
    `/admin/user-permissions/${userUuid}`,
  );
  return data;
}
