import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  type EntityRolePermissions,
  getEntityRolePermissions,
} from "~/api/entity_roles.api";
import { Select } from "../ds/atoms/Select";
import { EditPermissionsDialog } from "./EditPermissionsDialog";
import type { RoleT } from "./types";

// Stable empty reference: the dialog re-hydrates whenever the `permissions` prop
// reference changes, so a fresh `[]` each render would loop while a role loads.
const EMPTY_PERMISSIONS: EntityRolePermissions[] = [];

interface RolePermissionsDialogProps {
  open: boolean;
  onClose: () => void;
  roles: RoleT[];
  /** Role to select when the dialog opens (e.g. the clicked row or the first role). */
  initialRoleUuid: string;
}

export default function RolePermissionsDialog({
  open,
  onClose,
  roles,
  initialRoleUuid,
}: RolePermissionsDialogProps) {
  const [selectedRoleUuid, setSelectedRoleUuid] = useState(initialRoleUuid);

  // Reset to the triggering role each time the dialog opens.
  useEffect(() => {
    if (open) setSelectedRoleUuid(initialRoleUuid);
  }, [open, initialRoleUuid]);

  const selectedRole = roles.find((role) => role.uuid === selectedRoleUuid) ?? null;

  const { data } = useQuery({
    queryKey: ["entityRolePermissions", selectedRoleUuid],
    queryFn: () => getEntityRolePermissions(selectedRoleUuid),
    enabled: open && !!selectedRoleUuid,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
  const permissions = data ?? EMPTY_PERMISSIONS;

  if (!selectedRole) return null;

  return (
    <EditPermissionsDialog
      open={open}
      setOpen={(value) => {
        if (!value) onClose();
      }}
      role={selectedRole}
      permissions={permissions}
      roleSelector={
        <Select
          size="sm"
          className="w-[220px]"
          options={roles.map((role) => ({ label: role.name, value: role.uuid }))}
          value={selectedRoleUuid}
          onChange={(value) => setSelectedRoleUuid(value)}
        />
      }
    />
  );
}
