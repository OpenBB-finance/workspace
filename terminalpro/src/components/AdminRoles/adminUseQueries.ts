import { useQuery } from "@tanstack/react-query";
import { getEntityMap, getUsers } from "~/api/admin.api";
import { getEntityRoles } from "~/api/entity_roles.api";
import type { EntityMapItem } from "~/types/entity.type";
import type { User } from "~/types/user.type";
import type { RoleT } from "./types";

export interface UserWithFullName extends User {
  fullName: string;
}

export function useUsers() {
  return useQuery<UserWithFullName[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const users = await getUsers();
      const transformedUsers = users.reduce(
        (acc, user) => {
          if (!user.email || acc[user.email]) return acc;

          acc[user.email] = {
            ...user,
            fullName: `${user.first_name} ${user.last_name}`,
          };
          return acc;
        },
        {} as Record<string, UserWithFullName>,
      );
      return Object.values(transformedUsers);
    },
    enabled: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 15, // 15 minutes
  });
}

/** Maps each permission-group (entity-map) uuid to its display name. */
export function buildEntityNameMap(items: EntityMapItem[]): Map<string, string> {
  return new Map(items.map((item) => [item.uuid, item.name]));
}

/** Shared entity-map query — cache key matches the invite dialog. */
export function useEntityMap() {
  return useQuery({
    queryKey: ["admin", "entities"],
    queryFn: getEntityMap,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 15, // 15 minutes
  });
}

/** Maps each user email to the names of the roles it belongs to. */
export function buildUserRolesMap(roles: RoleT[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const role of roles) {
    for (const email of role.users) {
      const existing = map.get(email);
      if (existing) existing.push(role.name);
      else map.set(email, [role.name]);
    }
  }
  return map;
}

/** Shared entity-roles query — cache key matches the invite form. */
export function useEntityRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: getEntityRoles,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
