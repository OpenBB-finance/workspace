import type { EntityThemeSettings } from "~/lib/state/tableChartThemes";
import type { EntityMapItem, EntitySettings } from "~/types/entity.type";
import type { CreateUserDTO, User, UserSources } from "~/types/user.type";
import { apiClient } from "./api";

interface BaseResponse {
  success: boolean;
  message?: string;
}

interface EntityInfo {
  expiration_date: null | string;
  used_seats: number;
  seats: number;
}

interface App {
  uuid: string;
  name: string;
  url: string;
  user_uuid: string;
  created_date: string;
  user_email: string;
  updated_date: string;
}

/* Users */

export async function getUsers() {
  const { data } = await apiClient.get<User[]>("/admin/users");
  return data;
}

export async function validateAdminAccess() {
  const { data } = await apiClient.get<BaseResponse>("/admin/validate");
  return data;
}

export async function inviteUser(user: CreateUserDTO) {
  const { data } = await apiClient.post<BaseResponse>("/admin/register", user);
  return data;
}

export async function updateUser(id: string, payload: Partial<User>) {
  const { data } = await apiClient.patch(`/admin/users/${id}`, payload);
  return data;
}

export async function deleteMe() {
  const { data } = await apiClient.delete<BaseResponse>("/user");
  return data;
}

export async function deleteUser(
  id: string,
  source: UserSources,
  remove?: boolean,
): Promise<{ success: boolean } | undefined> {
  if (source === "user") {
    if (remove) {
      // this endpoint removes the user from the entity
      const { data } = await apiClient.delete<BaseResponse>(
        `/admin/users/${id}/remove`,
      );
      return data;
    }
    // this endpoint soft deletes the user
    const { data } = await apiClient.delete<BaseResponse>(`/admin/users/${id}`);
    return data;
  }
  if (source === "invite") {
    const { data } = await apiClient.delete<BaseResponse>(`/admin/register/${id}`);
    return data;
  }
  if (source === "takeover") {
    const { data } = await apiClient.post<BaseResponse>(`/admin/users/${id}/revoke`);
    return data;
  }
}

export async function resetUserPassword(id: string) {
  const { data } = await apiClient.post<{
    success: boolean;
    temporary_password: string;
  }>(`/admin/reset-password/${id}`);
  return data;
}

export async function resetUser2FA(id: string) {
  const { data } = await apiClient.post<BaseResponse>(`/admin/reset-2fa/${id}`);
  return data;
}

export async function extendTrialUser(id: string) {
  const { data } = await apiClient.get<BaseResponse>(`/admin/extend-trial/${id}`);
  return data;
}

export async function createUser(user: CreateUserDTO) {
  const { data } = await apiClient.post<{
    success: boolean;
    temporary_password: string;
  }>("/admin/create-user", user);
  return data;
}

/* Entities */

export async function getEntity() {
  const { data } = await apiClient.get<EntitySettings>("/admin/entity");
  return data;
}

export async function getEntityInfo() {
  const { data } = await apiClient.get<EntityInfo>("/admin/entity-info");
  return data;
}

export async function updateEntity(payload: Partial<EntitySettings>) {
  const { data } = await apiClient.patch<BaseResponse>("/admin/entity", payload);
  return data;
}

export async function getEntityMap() {
  const { data } = await apiClient.get<EntityMapItem[]>("/admin/entity-map");
  return data;
}

export async function getApps() {
  const response = await apiClient.get<App[]>("/admin/apps");
  return response.data;
}

export async function updateEntityThemeSettings(
  payload: EntityThemeSettings,
): Promise<BaseResponse> {
  const { data } = await apiClient
    .patch<BaseResponse>("/admin/theme-settings", payload)
    .catch(() => ({
      data: { success: false, message: "Failed to update theme settings" },
    }));
  return data;
}
