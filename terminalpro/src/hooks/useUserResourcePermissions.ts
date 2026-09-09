import { type UseQueryOptions, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type FilePermissionsT,
  getUserResourcePermissions,
  type PromptPermissionsT,
} from "~/api/user_roles.api";
import {
  type ProcessedBackendT,
  useProcessBackendWidgets,
} from "~/hooks/useProcessBackendWidgets";
import type { Extension } from "~/lib/constants";
import { useShallowPermissionsStore } from "~/lib/state/permissions";

export type UserResourcePermissionsT<T extends boolean = false> = {
  backends: ProcessedBackendT<T>[];
  files: FilePermissionsT[];
  prompts: PromptPermissionsT[];
};
export type RolePermissionsOptions = Omit<
  UseQueryOptions<UserResourcePermissionsT, Error>,
  "queryKey"
>;

export function useUserResourcePermissions(
  options: RolePermissionsOptions = { enabled: true },
) {
  const setPermissions = useShallowPermissionsStore((state) => state.setPermissions);
  const processBackendWidgets = useProcessBackendWidgets();

  return useQuery({
    queryKey: ["userResourcePermissions"],
    queryFn: async (): Promise<UserResourcePermissionsT> => {
      try {
        const response = await getUserResourcePermissions();
        setPermissions(response);
        const { backends = [], files = [], prompts = [] } = response || {};

        const processedBackends = await Promise.all(
          backends.map(processBackendWidgets),
        );

        return {
          backends: processedBackends,
          files: files.map((file) => ({
            ...file,
            extension: file.url?.split(".").pop() as Extension,
            shared: true,
          })),
          prompts,
        };
      } catch (error) {
        console.error("Failed to fetch user resource permissions:", error);
        toast.error("Failed to load shared resources");
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    ...options,
  });
}
