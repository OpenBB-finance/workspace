import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/api/api";
import { getUserResourcePermissions } from "~/api/user_roles.api";

vi.mock("~/api/api", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("User Roles API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserResourcePermissions", () => {
    it("should fetch user resource permissions correctly", async () => {
      const mockData = {
        backends: [],
        files: [],
        prompts: [],
      };
      vi.spyOn(apiClient, "get").mockResolvedValue({ data: mockData });

      const data = await getUserResourcePermissions();
      expect(data).toEqual(mockData);
      expect(apiClient.get).toHaveBeenCalledWith("/pro/resource-permissions");
    });

    it("should return empty permissions on error", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(apiClient, "get").mockRejectedValue(new Error("API Error"));

      const data = await getUserResourcePermissions();
      expect(data).toEqual({ backends: [], files: [], prompts: [] });
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
