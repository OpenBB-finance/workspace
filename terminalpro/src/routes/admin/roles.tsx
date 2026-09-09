import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { getEntityRoles } from "~/api/entity_roles.api";
import { ActivityLogPage } from "~/components/AdminRoles/ActivityLogPage";
import RolesPage from "~/components/AdminRoles/RolesPage";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import { useShallowPromptLibraryStore } from "~/lib/state/promptLibrary";

const TABS = [
  { label: "Roles and Permissions", id: "roles", disabled: false },
  { label: "Activity Log", id: "activity-log", disabled: false },
];

export default function AdminRoles() {
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const initializePrompts = useShallowPromptLibraryStore(
    (state) => state.initializePrompts,
  );

  const activeTab = params.get("tab");

  const {
    data: roles = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["roles"],
    queryFn: getEntityRoles,
    enabled: true,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (activeTab === "activity-log") {
      queryClient.invalidateQueries({ queryKey: ["activityLog"] });
    }
  }, [activeTab]);

  useEffect(() => {
    initializePrompts();
  }, []);

  return (
    <SettingsLayout title="Role Management" tabs={TABS} defaultTab="roles">
      <RolesPage roles={roles} isLoading={isLoading} error={error as Error} />
      <ActivityLogPage />
    </SettingsLayout>
  );
}
