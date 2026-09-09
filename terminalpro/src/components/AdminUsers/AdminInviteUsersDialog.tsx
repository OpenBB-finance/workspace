import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getEntityMap } from "~/api/admin.api";
import ImportUsers from "~/components/AdminUsers/InviteUser/ImportUsers";
import InviteSingleUser from "~/components/AdminUsers/InviteUser/InviteSingleUser";
import { isLiteEnvironment } from "~/lib/onPremFeatureFlags";
import { BaseDialog, type BaseDialogProps } from "../ds/dialogs/BaseDialog";
import { DialogHeader, DialogTitle } from "../ds/dialogs/Dialog";
import { Tabs, TabsList, TabsTrigger } from "../ds/molecules/Tabs";

export function AdminInviteUsersDialog({ open, onClose }: BaseDialogProps) {
  const [selectedTab, setSelectedTab] = useState<"single" | "import">("single");
  const entitiesQuery = useQuery({
    queryKey: ["admin", "entities"],
    queryFn: getEntityMap,
    enabled: true,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 15, // 15 minutes
  });
  const entitiesData = entitiesQuery.data || [];
  const trialUUID = entitiesData.find((e) => e.name === "Trial")?.uuid;
  const permissionsUUID = trialUUID
    ? trialUUID
    : entitiesData.find((e) => e.name === "User")?.uuid;

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      className="max-w-xs lg:max-w-xl"
      modal={true}
    >
      <DialogHeader>
        <DialogTitle>{isLiteEnvironment() ? "Add Users" : "Invite Users"}</DialogTitle>
      </DialogHeader>
      {permissionsUUID ? (
        <div className="flex flex-col gap-[20px] h-full grow">
          <Tabs
            className="flex flex-col h-full grow"
            value={selectedTab}
            onValueChange={(e: "single" | "import") => setSelectedTab(e)}
          >
            <TabsList className="mb-4">
              <TabsTrigger value="single">Add a single user</TabsTrigger>
              <TabsTrigger value="import">Import users</TabsTrigger>
            </TabsList>

            <InviteSingleUser permissions={permissionsUUID} onClose={onClose} />
            <ImportUsers permissions={permissionsUUID} onClose={onClose} />
          </Tabs>
        </div>
      ) : (
        <p className="text-alert-error flex pb-2">
          This entity does not have a User entitlement, please add one.
        </p>
      )}
    </BaseDialog>
  );
}
