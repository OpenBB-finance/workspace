import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { deleteEntityRole } from "~/api/entity_roles.api";
import type { DataTableColumn } from "~/components/ds/molecules/DataTable";
import { DataTable } from "~/components/ds/molecules/DataTable";
import BrandedLoadingState from "~/components/General/BrandedLoadingState";
import { useStateReducer } from "~/hooks/useStateReducer";
import { Button } from "../ds/atoms/Button";
import { Input } from "../ds/atoms/Input";
import { ConfirmDialog } from "../ds/dialogs/ConfirmDialog";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { RoleDialog } from "./RoleDialog";
import RoleMembersCell from "./RoleMembersCell";
import RolePermissionsDialog from "./RolePermissionsDialog";
import type { RoleT } from "./types";

interface RolesPageProps {
  roles: RoleT[];
  isLoading: boolean;
  error: Error | null;
}

const getRoleId = (role: RoleT) => role.name;

export default function RolesPage({ roles, isLoading, error }: RolesPageProps) {
  const queryClient = useQueryClient();

  const [state, dispatch] = useStateReducer({
    open: false,
    searchTerm: "",
    editingRole: undefined,
    deleteConfirmOpen: false,
    RoleToDelete: undefined,
    permOpen: false,
    permRole: null as RoleT | null,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEntityRole,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["roles"] });
      toast.success("Role successfully deleted");
    },
    onError: () => {
      toast.error("Failed to delete role");
    },
  });

  const filteredRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          role.name.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
          role.description.toLowerCase().includes(state.searchTerm.toLowerCase()),
      ),
    [roles, state.searchTerm],
  );

  const handleEdit = useCallback(
    (role: RoleT) => dispatch({ editingRole: role, open: true }),
    [],
  );

  const handleEditPermissions = useCallback(
    (role: RoleT) => dispatch({ permRole: role, permOpen: true }),
    [],
  );

  const handleClose = useCallback(() => {
    dispatch({ open: false, editingRole: undefined });
  }, []);

  const handleDelete = useCallback(
    (role: RoleT) => dispatch({ RoleToDelete: role, deleteConfirmOpen: true }),
    [],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (state.RoleToDelete) {
      await deleteMutation.mutateAsync(state.RoleToDelete.uuid);
    }
    dispatch({ deleteConfirmOpen: false, RoleToDelete: undefined });
  }, [state.RoleToDelete, deleteMutation.mutateAsync]);

  const handleSearch = useCallback(
    (value: string) => dispatch({ searchTerm: value }),
    [],
  );

  const columns = useMemo<DataTableColumn<RoleT>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        width: "26%",
        minWidth: 150,
        cell: (role) => <span className="body-xs-medium">{role.name}</span>,
      },
      {
        id: "members",
        header: "Members",
        width: "14%",
        minWidth: 120,
        truncate: false,
        cell: (role) => <RoleMembersCell role={role} />,
      },
      {
        id: "createdAt",
        header: "Creation date",
        width: "14%",
        minWidth: 120,
        cell: (role) => new Date(role.createdAt).toLocaleDateString(),
      },
      {
        id: "description",
        header: "Description",
        width: "46%",
        minWidth: 200,
        cell: (role) => role.description || "-",
      },
    ],
    [],
  );

  const renderRowActions = useCallback(
    (role: RoleT) => (
      <>
        <Tooltip position="top" message="Edit permissions">
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 obb-small-navbar-btn rounded flex items-center justify-center"
            onClick={() => handleEditPermissions(role)}
          >
            <Icon id="key-icon" className="size-3.5" />
          </button>
        </Tooltip>
        <Tooltip position="top" message="Edit role">
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 obb-small-navbar-btn rounded flex items-center justify-center"
            onClick={() => handleEdit(role)}
          >
            <Icon id="edit" className="size-3.5" />
          </button>
        </Tooltip>
        <Tooltip position="top" message="Delete role">
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 obb-small-navbar-btn rounded flex items-center justify-center"
            onClick={() => handleDelete(role)}
          >
            <Icon id="trash-04" className="size-3.5" />
          </button>
        </Tooltip>
      </>
    ),
    [handleEditPermissions, handleEdit, handleDelete],
  );

  if (isLoading) {
    return (
      <TabsPrimitive.Content value="roles" className="p-6 text-sm only-sm:h-screen">
        <div className="flex h-full items-center justify-center py-20">
          <BrandedLoadingState />
        </div>
      </TabsPrimitive.Content>
    );
  }

  if (error) {
    return (
      <TabsPrimitive.Content value="roles" className="p-6 text-sm only-sm:h-screen">
        <p className="text-xs">Error loading roles.</p>
      </TabsPrimitive.Content>
    );
  }

  return (
    <TabsPrimitive.Content value="roles" className="p-6 text-sm only-sm:h-screen">
      {roles.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center min-h-[248px] bg-general-bg-primary rounded">
          <p className="text-ds-text-heading mb-2 body-sm-bold">No roles created</p>
          <p className="body-xs-regular text-ds-text-caption">
            You haven't created any roles yet.
            <br />
            Please create a role.
          </p>
          <Button
            size="sm"
            variant="primary"
            className="mt-6"
            onClick={() => dispatch({ open: true })}
            data-testid="_admin-create-group-button"
          >
            Create new role
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-[10px]">
            <Input
              size="xs"
              className="min-w-[270px] h-8 [&_input]:h-8"
              placeholder="Search for a role"
              prefix={<Icon id="search" />}
              clearable={true}
              value={state.searchTerm}
              onChange={(value) => handleSearch(value.toString())}
            />
            <div className="flex-1" />
            <Button
              variant="secondary"
              size="sm"
              disabled={roles.length === 0}
              onClick={() => dispatch({ permRole: roles[0] ?? null, permOpen: true })}
            >
              Edit permissions
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => dispatch({ open: true })}
            >
              Create new role
            </Button>
          </div>
          <DataTable
            className="mt-6"
            columns={columns}
            data={filteredRoles}
            getRowId={getRoleId}
            renderRowActions={renderRowActions}
          />
        </>
      )}
      <RoleDialog
        open={state.open}
        onClose={handleClose}
        mode={state.editingRole ? "edit" : "create"}
        initialData={state.editingRole}
        roles={roles.map((role) => role.name)}
      />

      <RolePermissionsDialog
        open={state.permOpen}
        onClose={() => dispatch({ permOpen: false })}
        roles={roles}
        initialRoleUuid={state.permRole?.uuid ?? ""}
      />

      <ConfirmDialog
        open={state.deleteConfirmOpen}
        onClose={() => dispatch({ deleteConfirmOpen: false })}
        title="Delete role"
        description="Are you sure you want to continue? This role will be permanently deleted."
        confirmButton={
          <Button variant="danger" size="sm" onClick={handleConfirmDelete}>
            Yes, Delete
          </Button>
        }
        cancelText="Cancel"
      />
    </TabsPrimitive.Content>
  );
}
