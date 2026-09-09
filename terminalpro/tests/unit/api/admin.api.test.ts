import type { AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUser,
  deleteUser,
  extendTrialUser,
  getEntity,
  getEntityInfo,
  getEntityMap,
  getUsers,
  inviteUser,
  updateEntity,
  updateUser,
} from "~/api/admin.api";
import { apiClient } from "~/api/api";
import type { EntitySettings } from "~/types/entity.type";
import type { User } from "~/types/user.type";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockedAxiosMethod<T = any> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (url: string, ...args: any[]): Promise<AxiosResponse<T>>;
  mockResolvedValueOnce: (value: { data: T }) => void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockRejectedValueOnce: (error: any) => void;
};

// Mock the apiClient
vi.mock("~/api/api", () => ({
  apiClient: {
    get: vi.fn() as MockedAxiosMethod,
    post: vi.fn() as MockedAxiosMethod,
    patch: vi.fn() as MockedAxiosMethod,
    delete: vi.fn() as MockedAxiosMethod,
  },
}));

const mockData = {
  users: [
    {
      uuid: "1",
      first_name: "Justin",
      last_name: "Alfonso",
      email: "justin.alfonso@openbb.dev",
      role: "user",
      billing_active: true,
      pro_entitlements: {
        fmp: "None" as const,
        benzinga: "None" as const,
        intrinio: "None" as const,
        tradingeconomics: "None" as const,
      },
      status: "active",
      last_login: "2024-01-01",
      last_active: "2024-01-01",
      permissions_uuid: "some-permission-uuid",
      source: "user" as const,
      renewed: true,
    },
  ],
  baseResponse: { success: true, message: "Success" },
  resetPasswordResponse: { success: true, temporary_password: "random-password" },
  entitySettings: { require_authenticator: true },
  entityInfo: { expiration_date: null, used_seats: 5, seats: 10 },
  entityMap: [{ uuid: "1", name: "Entity1" }],
  providers: { benzinga: "key1" },
};

describe("API functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch users", async () => {
    (apiClient.get as MockedAxiosMethod<User[]>).mockResolvedValueOnce({
      data: mockData.users,
    });
    const users = await getUsers();
    expect(apiClient.get).toHaveBeenCalledWith("/admin/users");
    expect(users).toEqual(mockData.users);
  });

  it("should invite a user", async () => {
    const newUser = { email: "test@example.com" };
    (apiClient.post as MockedAxiosMethod).mockResolvedValueOnce({
      data: mockData.baseResponse,
    });
    const response = await inviteUser(newUser);
    expect(apiClient.post).toHaveBeenCalledWith("/admin/register", newUser);
    expect(response).toEqual(mockData.baseResponse);
  });

  it("should create a user", async () => {
    const newUser = { email: "test@example.com" };
    (apiClient.post as MockedAxiosMethod).mockResolvedValueOnce({
      data: mockData.resetPasswordResponse,
    });
    const response = await createUser(newUser);
    expect(apiClient.post).toHaveBeenCalledWith("/admin/create-user", newUser);
    expect(response).toEqual(mockData.resetPasswordResponse);
  });

  it("should update a user", async () => {
    const userId = "1";
    const payload: Partial<User> = { first_name: "Justin", last_name: "Alfonso" };
    (apiClient.patch as MockedAxiosMethod).mockResolvedValueOnce({
      data: mockData.baseResponse,
    });
    const response = await updateUser(userId, payload);
    expect(apiClient.patch).toHaveBeenCalledWith(`/admin/users/${userId}`, payload);
    expect(response).toEqual(mockData.baseResponse);
  });

  it("should delete a user", async () => {
    const userId = "1";
    (apiClient.delete as MockedAxiosMethod).mockResolvedValueOnce({
      data: mockData.baseResponse,
    });
    const response = await deleteUser(userId, "user");
    expect(apiClient.delete).toHaveBeenCalledWith(`/admin/users/${userId}`);
    expect(response).toEqual(mockData.baseResponse);
  });

  it("should extend a trial user", async () => {
    const userId = "1";
    (apiClient.get as MockedAxiosMethod).mockResolvedValueOnce({
      data: mockData.baseResponse,
    });
    const response = await extendTrialUser(userId);
    expect(apiClient.get).toHaveBeenCalledWith(`/admin/extend-trial/${userId}`);
    expect(response).toEqual(mockData.baseResponse);
  });

  it("should fetch entity settings", async () => {
    (apiClient.get as MockedAxiosMethod).mockResolvedValueOnce({
      data: mockData.entitySettings,
    });
    const entitySettings = await getEntity();
    expect(apiClient.get).toHaveBeenCalledWith("/admin/entity");
    expect(entitySettings).toEqual(mockData.entitySettings);
  });

  it("should fetch entity info", async () => {
    (apiClient.get as MockedAxiosMethod).mockResolvedValueOnce({
      data: mockData.entityInfo,
    });
    const entityInfo = await getEntityInfo();
    expect(apiClient.get).toHaveBeenCalledWith("/admin/entity-info");
    expect(entityInfo).toEqual(mockData.entityInfo);
  });

  it("should update entity settings", async () => {
    const payload: Partial<EntitySettings> = { require_authenticator: false };
    (apiClient.patch as MockedAxiosMethod).mockResolvedValueOnce({
      data: mockData.baseResponse,
    });
    const response = await updateEntity(payload);
    expect(apiClient.patch).toHaveBeenCalledWith("/admin/entity", payload);
    expect(response).toEqual(mockData.baseResponse);
  });

  it("should fetch entity map", async () => {
    (apiClient.get as MockedAxiosMethod).mockResolvedValueOnce({
      data: mockData.entityMap,
    });
    const entityMap = await getEntityMap();
    expect(apiClient.get).toHaveBeenCalledWith("/admin/entity-map");
    expect(entityMap).toEqual(mockData.entityMap);
  });
});
