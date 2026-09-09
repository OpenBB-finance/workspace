import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/api/api";
import {
  deleteEntityRole,
  type EntityRolePermissions,
  getEntityRoleActivityLog,
  getEntityRolePermissions,
  getEntityRoles,
  getUserPermissions,
  patchEntityRole,
  postEntityRole,
  putEntityRolePermissions,
} from "~/api/entity_roles.api";
import type { RoleT } from "~/components/AdminRoles/types";

vi.mock("~/api/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

describe("Entity Roles API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEntityRoles", () => {
    it("should return roles with transformed date fields", async () => {
      const mockApiResponse = [
        {
          uuid: "role-uuid-1",
          name: "Admin Role",
          description: "Full access role",
          users: ["user1@example.com", "user2@example.com"],
          updated_date: "2024-01-15T10:30:00Z",
        },
        {
          uuid: "role-uuid-2",
          name: "Viewer Role",
          description: "Read-only access",
          users: [],
          updated_date: "2024-02-20T14:45:00Z",
        },
      ];

      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockApiResponse });

      const result = await getEntityRoles();

      expect(apiClient.get).toHaveBeenCalledWith("/admin/role");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        uuid: "role-uuid-1",
        name: "Admin Role",
        description: "Full access role",
        users: ["user1@example.com", "user2@example.com"],
        createdAt: new Date("2024-01-15T10:30:00Z").getTime(),
      });
      expect(result[1]).toEqual({
        uuid: "role-uuid-2",
        name: "Viewer Role",
        description: "Read-only access",
        users: [],
        createdAt: new Date("2024-02-20T14:45:00Z").getTime(),
      });
    });

    it("should return empty array when no roles exist", async () => {
      vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] });

      const result = await getEntityRoles();

      expect(apiClient.get).toHaveBeenCalledWith("/admin/role");
      expect(result).toEqual([]);
    });

    it("should propagate 401 unauthorized errors", async () => {
      const error = {
        response: { status: 401, data: { detail: "Unauthorized" } },
      };
      vi.spyOn(apiClient, "get").mockRejectedValue(error);

      await expect(getEntityRoles()).rejects.toEqual(error);
    });

    it("should propagate 500 server errors", async () => {
      const error = {
        response: { status: 500, data: { detail: "Internal server error" } },
      };
      vi.spyOn(apiClient, "get").mockRejectedValue(error);

      await expect(getEntityRoles()).rejects.toEqual(error);
    });
  });

  describe("postEntityRole", () => {
    it("should create a new role and return success response", async () => {
      const mockRole: RoleT = {
        uuid: "new-role-uuid",
        name: "New Role",
        description: "A newly created role",
        users: ["user@example.com"],
        createdAt: Date.now(),
      };

      const mockResponse = { success: true };
      vi.spyOn(apiClient, "post").mockResolvedValue({ data: mockResponse });

      const result = await postEntityRole(mockRole);

      expect(apiClient.post).toHaveBeenCalledWith("/admin/role", {
        uuid: "new-role-uuid",
        name: "New Role",
        description: "A newly created role",
        users: ["user@example.com"],
      });
      expect(result).toEqual({ success: true });
    });

    it("should exclude createdAt from the request payload", async () => {
      const mockRole: RoleT = {
        uuid: "role-uuid",
        name: "Test Role",
        description: "Test",
        users: [],
        createdAt: 1705320600000,
      };

      vi.spyOn(apiClient, "post").mockResolvedValue({ data: { success: true } });

      await postEntityRole(mockRole);

      const callArgs = vi.mocked(apiClient.post).mock.calls[0][1];
      expect(callArgs).not.toHaveProperty("createdAt");
    });

    it("should handle 401 unauthorized errors", async () => {
      const mockRole: RoleT = {
        uuid: "role-uuid",
        name: "Test",
        description: "",
        users: [],
        createdAt: Date.now(),
      };

      const error = {
        response: { status: 401, data: { detail: "Unauthorized" } },
      };
      vi.spyOn(apiClient, "post").mockRejectedValue(error);

      await expect(postEntityRole(mockRole)).rejects.toEqual(error);
    });

    it("should handle validation errors", async () => {
      const mockRole: RoleT = {
        uuid: "",
        name: "",
        description: "",
        users: [],
        createdAt: Date.now(),
      };

      const error = {
        response: { status: 400, data: { detail: "Name is required" } },
      };
      vi.spyOn(apiClient, "post").mockRejectedValue(error);

      await expect(postEntityRole(mockRole)).rejects.toEqual(error);
    });
  });

  describe("patchEntityRole", () => {
    it("should update an existing role and return success response", async () => {
      const mockRole: RoleT = {
        uuid: "existing-role-uuid",
        name: "Updated Role Name",
        description: "Updated description",
        users: ["user1@example.com", "user2@example.com"],
        createdAt: Date.now(),
      };

      const mockResponse = { success: true };
      vi.spyOn(apiClient, "patch").mockResolvedValue({ data: mockResponse });

      const result = await patchEntityRole(mockRole);

      expect(apiClient.patch).toHaveBeenCalledWith("/admin/role/existing-role-uuid", {
        name: "Updated Role Name",
        description: "Updated description",
        users: ["user1@example.com", "user2@example.com"],
      });
      expect(result).toEqual({ success: true });
    });

    it("should exclude uuid and createdAt from the request payload", async () => {
      const mockRole: RoleT = {
        uuid: "role-uuid",
        name: "Test",
        description: "Test",
        users: [],
        createdAt: 1705320600000,
      };

      vi.spyOn(apiClient, "patch").mockResolvedValue({ data: { success: true } });

      await patchEntityRole(mockRole);

      const callArgs = vi.mocked(apiClient.patch).mock.calls[0][1];
      expect(callArgs).not.toHaveProperty("uuid");
      expect(callArgs).not.toHaveProperty("createdAt");
    });

    it("should handle 404 not found errors", async () => {
      const mockRole: RoleT = {
        uuid: "non-existent-uuid",
        name: "Test",
        description: "",
        users: [],
        createdAt: Date.now(),
      };

      const error = {
        response: { status: 404, data: { detail: "Role not found" } },
      };
      vi.spyOn(apiClient, "patch").mockRejectedValue(error);

      await expect(patchEntityRole(mockRole)).rejects.toEqual(error);
    });

    it("should handle 500 server errors", async () => {
      const mockRole: RoleT = {
        uuid: "role-uuid",
        name: "Test",
        description: "",
        users: [],
        createdAt: Date.now(),
      };

      const error = {
        response: { status: 500, data: { detail: "Database error" } },
      };
      vi.spyOn(apiClient, "patch").mockRejectedValue(error);

      await expect(patchEntityRole(mockRole)).rejects.toEqual(error);
    });
  });

  describe("deleteEntityRole", () => {
    it("should delete a role and return success response", async () => {
      const mockResponse = { success: true };
      vi.spyOn(apiClient, "delete").mockResolvedValue({ data: mockResponse });

      const result = await deleteEntityRole("role-to-delete-uuid");

      expect(apiClient.delete).toHaveBeenCalledWith("/admin/role/role-to-delete-uuid");
      expect(result).toEqual({ success: true });
    });

    it("should handle 404 not found errors for invalid UUID", async () => {
      const error = {
        response: { status: 404, data: { detail: "Role not found" } },
      };
      vi.spyOn(apiClient, "delete").mockRejectedValue(error);

      await expect(deleteEntityRole("invalid-uuid")).rejects.toEqual(error);
    });

    it("should handle 401 unauthorized errors", async () => {
      const error = {
        response: { status: 401, data: { detail: "Unauthorized" } },
      };
      vi.spyOn(apiClient, "delete").mockRejectedValue(error);

      await expect(deleteEntityRole("role-uuid")).rejects.toEqual(error);
    });

    it("should handle empty uuid parameter", async () => {
      vi.spyOn(apiClient, "delete").mockResolvedValue({ data: { success: false } });

      await deleteEntityRole("");

      expect(apiClient.delete).toHaveBeenCalledWith("/admin/role/");
    });
  });

  describe("getEntityRolePermissions", () => {
    it("should return permissions with file permissions grouped by extension", async () => {
      const mockApiResponse: EntityRolePermissions[] = [
        {
          uuid: "file-perm-1",
          access: "access",
          category: "files",
          type: "file",
          file_extension: "pdf",
        },
        {
          uuid: "file-perm-2",
          access: "no-access",
          category: "files",
          type: "file",
          file_extension: "pdf",
        },
        {
          uuid: "backend-perm-1",
          access: "access",
          category: "backends",
          type: "backend",
          file_extension: null,
        },
      ];

      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockApiResponse });

      const result = await getEntityRolePermissions("role-uuid");

      expect(apiClient.get).toHaveBeenCalledWith("/admin/role-permissions/role-uuid");
      expect(result).toHaveLength(2);

      const filePermission = result.find((p) => p.type === "file");
      expect(filePermission).toEqual({
        uuid: "pdf",
        access: "access",
        category: "files",
        type: "file",
        file_extension: "pdf",
        widgets: [
          { widgetId: "file-perm-1", access: "access" },
          { widgetId: "file-perm-2", access: "no-access" },
        ],
      });

      const backendPermission = result.find((p) => p.type === "backend");
      expect(backendPermission).toEqual({
        uuid: "backend-perm-1",
        access: "access",
        category: "backends",
        type: "backend",
        file_extension: null,
      });
    });

    it("should return non-file permissions unchanged", async () => {
      const mockApiResponse: EntityRolePermissions[] = [
        {
          uuid: "prompt-perm-1",
          access: "access",
          category: "prompts",
          type: "prompt",
          file_extension: null,
          templates: [
            {
              templateId: "template-1",
              access: "access",
              prompts: [{ promptId: "prompt-1", access: "access" }],
            },
          ],
        },
      ];

      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockApiResponse });

      const result = await getEntityRolePermissions("role-uuid");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockApiResponse[0]);
    });

    it("should return empty array when no permissions exist", async () => {
      vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] });

      const result = await getEntityRolePermissions("role-uuid");

      expect(result).toEqual([]);
    });

    it("should handle 404 not found errors", async () => {
      const error = {
        response: { status: 404, data: { detail: "Role not found" } },
      };
      vi.spyOn(apiClient, "get").mockRejectedValue(error);

      await expect(getEntityRolePermissions("invalid-uuid")).rejects.toEqual(error);
    });

    it("should group multiple file extensions separately", async () => {
      const mockApiResponse: EntityRolePermissions[] = [
        {
          uuid: "pdf-perm-1",
          access: "access",
          category: "files",
          type: "file",
          file_extension: "pdf",
        },
        {
          uuid: "csv-perm-1",
          access: "access",
          category: "files",
          type: "file",
          file_extension: "csv",
        },
        {
          uuid: "pdf-perm-2",
          access: "no-access",
          category: "files",
          type: "file",
          file_extension: "pdf",
        },
      ];

      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockApiResponse });

      const result = await getEntityRolePermissions("role-uuid");

      expect(result).toHaveLength(2);

      const pdfPermission = result.find(
        (p) => p.type === "file" && p.file_extension === "pdf",
      );
      expect(pdfPermission?.widgets).toHaveLength(2);

      const csvPermission = result.find(
        (p) => p.type === "file" && p.file_extension === "csv",
      );
      expect(csvPermission?.widgets).toHaveLength(1);
    });
  });

  describe("putEntityRolePermissions", () => {
    it("should update role permissions and return success response", async () => {
      const permissions: EntityRolePermissions[] = [
        {
          uuid: "perm-1",
          access: "access",
          category: "backends",
          type: "backend",
          file_extension: null,
        },
      ];

      const mockResponse = { success: true };
      vi.spyOn(apiClient, "put").mockResolvedValue({ data: mockResponse });

      const result = await putEntityRolePermissions("role-uuid", permissions);

      expect(apiClient.put).toHaveBeenCalledWith(
        "/admin/role-permissions/role-uuid",
        expect.any(Array),
      );
      expect(result).toEqual({ success: true });
    });

    it("should flatten file permissions with widgets", async () => {
      const permissions: EntityRolePermissions[] = [
        {
          uuid: "pdf",
          access: "access",
          category: "files",
          type: "file",
          file_extension: "pdf",
          widgets: [
            { widgetId: "widget-1", access: "access" },
            { widgetId: "widget-2", access: "no-access" },
          ],
        },
      ];

      vi.spyOn(apiClient, "put").mockResolvedValue({ data: { success: true } });

      await putEntityRolePermissions("role-uuid", permissions);

      const callArgs = vi.mocked(apiClient.put).mock.calls[0][1];
      expect(callArgs).toEqual([
        { uuid: "widget-1", access: "access", category: "files", type: "file" },
        { uuid: "widget-2", access: "no-access", category: "files", type: "file" },
      ]);
    });

    it("should consolidate prompt permissions with same UUID and category", async () => {
      const permissions: EntityRolePermissions[] = [
        {
          uuid: "prompt-uuid",
          access: "access",
          category: "prompts",
          type: "prompt",
          file_extension: null,
          templates: [{ templateId: "template-1", access: "access" }],
        },
        {
          uuid: "prompt-uuid",
          access: "access",
          category: "prompts",
          type: "prompt",
          file_extension: null,
          templates: [{ templateId: "template-2", access: "no-access" }],
        },
      ];

      vi.spyOn(apiClient, "put").mockResolvedValue({ data: { success: true } });

      await putEntityRolePermissions("role-uuid", permissions);

      const callArgs = vi.mocked(apiClient.put).mock
        .calls[0][1] as EntityRolePermissions[];
      expect(callArgs).toHaveLength(1);
      expect(callArgs[0].templates).toHaveLength(2);
    });

    it("should merge prompts within existing templates", async () => {
      const permissions: EntityRolePermissions[] = [
        {
          uuid: "prompt-uuid",
          access: "access",
          category: "prompts",
          type: "prompt",
          file_extension: null,
          templates: [
            {
              templateId: "template-1",
              access: "access",
              prompts: [{ promptId: "prompt-1", access: "access" }],
            },
          ],
        },
        {
          uuid: "prompt-uuid",
          access: "access",
          category: "prompts",
          type: "prompt",
          file_extension: null,
          templates: [
            {
              templateId: "template-1",
              access: "access",
              prompts: [{ promptId: "prompt-2", access: "no-access" }],
            },
          ],
        },
      ];

      vi.spyOn(apiClient, "put").mockResolvedValue({ data: { success: true } });

      await putEntityRolePermissions("role-uuid", permissions);

      const callArgs = vi.mocked(apiClient.put).mock
        .calls[0][1] as EntityRolePermissions[];
      expect(callArgs).toHaveLength(1);
      expect(callArgs[0].templates).toHaveLength(1);
      expect(callArgs[0].templates![0].prompts).toHaveLength(2);
    });

    it("should add no-access as default when access property is missing", async () => {
      const permissions: EntityRolePermissions[] = [
        {
          uuid: "perm-1",
          access: undefined as unknown as "access" | "no-access",
          category: "backends",
          type: "backend",
          file_extension: null,
        },
      ];

      vi.spyOn(apiClient, "put").mockResolvedValue({ data: { success: true } });

      await putEntityRolePermissions("role-uuid", permissions);

      const callArgs = vi.mocked(apiClient.put).mock
        .calls[0][1] as EntityRolePermissions[];
      expect(callArgs[0].access).toBe("no-access");
    });

    it("should handle 404 not found errors", async () => {
      const permissions: EntityRolePermissions[] = [];
      const error = {
        response: { status: 404, data: { detail: "Role not found" } },
      };
      vi.spyOn(apiClient, "put").mockRejectedValue(error);

      await expect(
        putEntityRolePermissions("invalid-uuid", permissions),
      ).rejects.toEqual(error);
    });

    it("should handle 500 server errors", async () => {
      const permissions: EntityRolePermissions[] = [];
      const error = {
        response: { status: 500, data: { detail: "Internal server error" } },
      };
      vi.spyOn(apiClient, "put").mockRejectedValue(error);

      await expect(putEntityRolePermissions("role-uuid", permissions)).rejects.toEqual(
        error,
      );
    });

    it("should prevent duplicate non-prompt permissions", async () => {
      const permissions: EntityRolePermissions[] = [
        {
          uuid: "backend-1",
          access: "access",
          category: "backends",
          type: "backend",
          file_extension: null,
        },
        {
          uuid: "backend-1",
          access: "no-access",
          category: "backends",
          type: "backend",
          file_extension: null,
        },
      ];

      vi.spyOn(apiClient, "put").mockResolvedValue({ data: { success: true } });

      await putEntityRolePermissions("role-uuid", permissions);

      const callArgs = vi.mocked(apiClient.put).mock
        .calls[0][1] as EntityRolePermissions[];
      expect(callArgs).toHaveLength(1);
      expect(callArgs[0].access).toBe("access");
    });
  });

  describe("getEntityRoleActivityLog", () => {
    it("should return transformed activity log entries", async () => {
      const mockApiResponse = [
        {
          uuid: "log-1",
          created_at: "2024-01-15T10:30:00Z",
          entity_uuid: "entity-uuid",
          role_uuid: "role-uuid",
          action: "create" as const,
          resource_type: "role" as const,
          resource_uuid: "resource-uuid",
          performed_by_email: "admin@example.com",
          details: { key: "value" },
          role_name: "Admin Role",
          details_msg: "Created new role",
        },
      ];

      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockApiResponse });

      const result = await getEntityRoleActivityLog();

      expect(apiClient.get).toHaveBeenCalledWith("admin/role-permissions-audit-logs");
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        uuid: "log-1",
        role: "Admin Role",
        performedBy: "admin@example.com",
        activityType: "Create role",
        timestamp: new Date("2024-01-15T10:30:00Z").getTime(),
        detailsMsg: "Created new role",
        details: { key: "value" },
      });
    });

    it("should capitalize action type correctly", async () => {
      const mockApiResponse = [
        {
          uuid: "log-1",
          created_at: "2024-01-15T10:30:00Z",
          entity_uuid: "entity-uuid",
          role_uuid: "role-uuid",
          action: "update" as const,
          resource_type: "backend" as const,
          resource_uuid: "resource-uuid",
          performed_by_email: "admin@example.com",
          details: {},
          role_name: "Test Role",
          details_msg: null,
        },
      ];

      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockApiResponse });

      const result = await getEntityRoleActivityLog();

      expect(result[0].activityType).toBe("Update backend");
    });

    it("should handle null details_msg by converting to empty string", async () => {
      const mockApiResponse = [
        {
          uuid: "log-1",
          created_at: "2024-01-15T10:30:00Z",
          entity_uuid: "entity-uuid",
          role_uuid: null,
          action: "delete" as const,
          resource_type: "file" as const,
          resource_uuid: "resource-uuid",
          performed_by_email: "admin@example.com",
          details: {},
          role_name: "Test Role",
          details_msg: null,
        },
      ];

      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockApiResponse });

      const result = await getEntityRoleActivityLog();

      expect(result[0].detailsMsg).toBe("");
    });

    it("should return empty array when no activity logs exist", async () => {
      vi.spyOn(apiClient, "get").mockResolvedValue({ data: [] });

      const result = await getEntityRoleActivityLog();

      expect(result).toEqual([]);
    });

    it("should handle 401 unauthorized errors", async () => {
      const error = {
        response: { status: 401, data: { detail: "Unauthorized" } },
      };
      vi.spyOn(apiClient, "get").mockRejectedValue(error);

      await expect(getEntityRoleActivityLog()).rejects.toEqual(error);
    });

    it("should handle 500 server errors", async () => {
      const error = {
        response: { status: 500, data: { detail: "Internal server error" } },
      };
      vi.spyOn(apiClient, "get").mockRejectedValue(error);

      await expect(getEntityRoleActivityLog()).rejects.toEqual(error);
    });

    it("should handle all action types correctly", async () => {
      const actions = [
        "create",
        "update",
        "delete",
        "restore",
        "assign",
        "remove",
        "add",
      ];

      for (const action of actions) {
        const mockApiResponse = [
          {
            uuid: `log-${action}`,
            created_at: "2024-01-15T10:30:00Z",
            entity_uuid: "entity-uuid",
            role_uuid: "role-uuid",
            action: action as "create",
            resource_type: "role" as const,
            resource_uuid: "resource-uuid",
            performed_by_email: "admin@example.com",
            details: {},
            role_name: "Test Role",
            details_msg: null,
          },
        ];

        vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockApiResponse });

        const result = await getEntityRoleActivityLog();
        const expectedCapitalized = action.charAt(0).toUpperCase() + action.slice(1);

        expect(result[0].activityType).toBe(`${expectedCapitalized} role`);
      }
    });
  });

  describe("getUserPermissions", () => {
    it("should return user permissions as object", async () => {
      const mockResponse = {
        data_connectors: [{ id: "connector-1", name: "Test Connector" }],
        templates: [{ id: "template-1", name: "Test Template" }],
        prompts: [{ id: "prompt-1", name: "Test Prompt" }],
      };

      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockResponse });

      const result = await getUserPermissions("user-uuid");

      expect(apiClient.get).toHaveBeenCalledWith("/admin/user-permissions/user-uuid");
      expect(result).toEqual(mockResponse);
    });

    it("should return user permissions as array when multiple sets exist", async () => {
      const mockResponse = [
        {
          data_connectors: [{ id: "connector-1" }],
          templates: [],
          prompts: [],
        },
        {
          data_connectors: [],
          templates: [{ id: "template-1" }],
          prompts: [],
        },
      ];

      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockResponse });

      const result = await getUserPermissions("user-uuid");

      expect(result).toEqual(mockResponse);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty permission sets", async () => {
      const mockResponse = {
        data_connectors: [],
        templates: [],
        prompts: [],
      };

      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockResponse });

      const result = await getUserPermissions("user-uuid");

      expect(result).toEqual(mockResponse);
    });

    it("should handle 404 not found errors for invalid user UUID", async () => {
      const error = {
        response: { status: 404, data: { detail: "User not found" } },
      };
      vi.spyOn(apiClient, "get").mockRejectedValue(error);

      await expect(getUserPermissions("invalid-user-uuid")).rejects.toEqual(error);
    });

    it("should handle 401 unauthorized errors", async () => {
      const error = {
        response: { status: 401, data: { detail: "Unauthorized" } },
      };
      vi.spyOn(apiClient, "get").mockRejectedValue(error);

      await expect(getUserPermissions("user-uuid")).rejects.toEqual(error);
    });

    it("should handle 500 server errors", async () => {
      const error = {
        response: { status: 500, data: { detail: "Internal server error" } },
      };
      vi.spyOn(apiClient, "get").mockRejectedValue(error);

      await expect(getUserPermissions("user-uuid")).rejects.toEqual(error);
    });

    it("should work with valid UUID format", async () => {
      const validUuid = "123e4567-e89b-12d3-a456-426614174000";
      const mockResponse = {
        data_connectors: [],
        templates: [],
        prompts: [],
      };

      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockResponse });

      await getUserPermissions(validUuid);

      expect(apiClient.get).toHaveBeenCalledWith(
        `/admin/user-permissions/${validUuid}`,
      );
    });
  });
});
