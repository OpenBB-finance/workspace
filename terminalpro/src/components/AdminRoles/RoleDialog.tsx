import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  deleteEntityRole,
  patchEntityRole,
  postEntityRole,
} from "~/api/entity_roles.api";
import { Button } from "../ds/atoms/Button";
import { FormInput, Input } from "../ds/atoms/Input";
import { Tag } from "../ds/atoms/Tag";
import { FormTextarea } from "../ds/atoms/TextArea";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { ConfirmDialog } from "../ds/dialogs/ConfirmDialog";
import { DialogFooter, DialogTitle } from "../ds/dialogs/Dialog";
import { Form, FormField } from "../ds/molecules/Form";
import { cn } from "../ds/utils";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import AddUsersSelect, { colorForEmail, getUserInitials } from "./AddUsersSelect";
import { useUsers } from "./adminUseQueries";
import type { RoleT } from "./types";

interface User {
  name: string;
  email: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initialData?: RoleT;
  roles: string[];
}

const createRoleSchema = (initialData: RoleT | undefined, roles: string[]) =>
  z
    .object({
      name: z.string().min(1, "Name is required"),
      description: z.string().optional(),
      users: z.array(z.string()).optional(),
    })
    .refine(
      (data) => {
        if (
          (initialData &&
            data.name !== initialData.name &&
            roles.includes(data.name)) ||
          (!initialData && roles.includes(data.name))
        ) {
          return false;
        }
        return true;
      },
      {
        message: "Role name already exists",
        path: ["name"],
      },
    );

type RoleForm = z.infer<ReturnType<typeof createRoleSchema>>;

const emptyDefaults: RoleForm = { name: "", description: "", users: [] };

export function RoleDialog(props: Props) {
  const { open, onClose, mode, initialData, roles } = props;
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: usersData = [], isLoading: isLoadingUsers, refetch } = useUsers();
  const [entityUsers, setEntityUsers] = useState<User[]>([]);

  useEffect(() => {
    if (usersData.length === 0) return;
    const transformedUsers = usersData
      .filter((user) => user.source !== "takeover" && user.permissions_uuid)
      .map((user) => ({
        name: user.fullName || `${user.first_name} ${user.last_name}`,
        email: user.email,
      }));
    setEntityUsers(transformedUsers);
  }, [usersData]);

  useEffect(() => {
    if (open) refetch();
  }, [open, refetch]);

  const resolver = useMemo(
    () => zodResolver(createRoleSchema(initialData, roles)),
    [initialData, roles],
  );

  const form = useForm<RoleForm>({
    resolver,
    mode: "onChange",
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      users: initialData?.users ?? [],
    },
  });

  useEffect(() => {
    if (mode === "edit" && initialData) {
      form.reset({
        name: initialData.name,
        description: initialData.description ?? "",
        users: initialData.users ?? [],
      });
      // Settle isValid on mount for prefilled edit forms.
      form.trigger();
    } else if (mode === "create") {
      form.reset(emptyDefaults);
    }
  }, [mode, initialData, open, form]);

  const createMutation = useMutation({
    mutationFn: postEntityRole,
    onSuccess: (_data, variables) => {
      queryClient.refetchQueries({ queryKey: ["roles"] });
      form.reset({
        name: variables.name,
        description: variables.description ?? "",
        users: variables.users ?? [],
      });
      toast.success("Role created");
      onClose();
    },
    onError: () => toast.error("Failed to create role"),
  });

  const updateMutation = useMutation({
    mutationFn: patchEntityRole,
    onSuccess: (_data, variables) => {
      queryClient.refetchQueries({ queryKey: ["roles"] });
      form.reset({
        name: variables.name,
        description: variables.description ?? "",
        users: variables.users ?? [],
      });
      toast.success("Role updated");
      onClose();
    },
    onError: () => toast.error("Failed to update role"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEntityRole,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["roles"] });
      toast.success("Role deleted");
      onClose();
    },
    onError: () => toast.error("Failed to delete role"),
  });

  const handleSubmit = useCallback(
    async (data: RoleForm) => {
      if (mode === "edit" && initialData) {
        const updatedRole = { ...initialData, ...data };
        await updateMutation.mutateAsync(updatedRole);
      } else {
        const newRole = {
          uuid: crypto.randomUUID(),
          name: data.name,
          description: data.description ?? "",
          users: data.users ?? [],
          createdAt: Date.now(),
        };
        await createMutation.mutateAsync(newRole);
      }
    },
    [mode, initialData, updateMutation.mutateAsync, createMutation.mutateAsync],
  );

  const handleDelete = useCallback(async () => {
    if (initialData) {
      await deleteMutation.mutateAsync(initialData.uuid);
    }
    setDeleteConfirmOpen(false);
  }, [deleteMutation.mutateAsync, initialData]);

  const users = form.watch("users");

  // Track the AddUsersSelect dropdown's open state. Close intents fired while
  // the dropdown is open (or in the same event window where the dropdown is
  // closing) are dismiss-dropdown clicks — not Dialog-close intents — so we
  // swallow them here. Without this, clicking the Dialog backdrop to dismiss
  // the dropdown also tries to close the Dialog and pops the discard confirm.
  const dropdownStateRef = useRef({ isOpen: false, closedAt: 0 });

  const handleAddUsersOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen && dropdownStateRef.current.isOpen) {
      dropdownStateRef.current.closedAt = Date.now();
    }
    dropdownStateRef.current.isOpen = isOpen;
  }, []);

  const requestClose = useCallback(() => {
    if (
      dropdownStateRef.current.isOpen ||
      Date.now() - dropdownStateRef.current.closedAt < 150
    ) {
      return;
    }
    if (form.formState.isDirty) {
      setDiscardConfirmOpen(true);
    } else {
      onClose();
    }
  }, [form, onClose]);

  const handleDiscard = useCallback(() => {
    form.reset(
      initialData
        ? {
            name: initialData.name,
            description: initialData.description ?? "",
            users: initialData.users ?? [],
          }
        : emptyDefaults,
    );
    setDiscardConfirmOpen(false);
    onClose();
  }, [form, initialData, onClose]);

  // Memoised member list for the dialog body — avoids O(n·m) .find on each
  // re-render now that every checkbox tick re-renders the parent.
  const filteredUsersList = useMemo(() => {
    return users
      .map((userEmail) => {
        const userInfo = entityUsers.find((user) => user.email === userEmail);
        if (!userInfo) return null;
        const matchesSearch =
          userInfo.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          userInfo.name.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return null;
        return {
          email: userEmail,
          name: userInfo.name,
          initials: getUserInitials(userInfo.name),
          color: colorForEmail(userEmail),
        };
      })
      .filter(Boolean) as Array<{
      email: string;
      name: string;
      initials: string;
      color: string;
    }>;
  }, [users, entityUsers, searchQuery]);

  const isSaving =
    createMutation.isPending || updateMutation.isPending || form.formState.isSubmitting;

  const title = mode === "create" ? "Create role" : "Edit role";
  const saveLabel = isSaving
    ? "Saving…"
    : mode === "create"
      ? "Create role"
      : "Save changes";

  return (
    <>
      <BaseDialog
        open={open}
        onClose={requestClose}
        onPointerDownOutside={(e) => e.preventDefault()}
        className="max-w-md lg:max-w-3xl xl:max-w-5xl max-h-[760px] overflow-y-auto"
      >
        <div className="flex items-center gap-2">
          <DialogTitle
            className={cn({
              "pr-0": form.formState.isDirty,
            })}
          >
            {title}
          </DialogTitle>
          {form.formState.isDirty && (
            <Tag color="grey" className="shrink-0">
              Unsaved
            </Tag>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="mb-4 flex flex-col gap-2">
              <FormField
                name="name"
                control={form.control}
                render={({ field }) => (
                  <FormInput
                    label="Name"
                    className="h-8"
                    placeholder="Enter name"
                    error={!!form.formState.errors.name}
                    message={form.formState.errors.name?.message}
                    {...field}
                  />
                )}
              />

              <FormField
                name="description"
                control={form.control}
                render={({ field }) => (
                  <FormTextarea
                    label={
                      <p>
                        Description
                        <span className="text-ds-text-caption italic"> (optional)</span>
                      </p>
                    }
                    placeholder="Describe the purpose of this role"
                    {...field}
                  />
                )}
              />

              <div className="space-y-2.5">
                <FormField
                  name="users"
                  control={form.control}
                  render={({ field }) => (
                    <AddUsersSelect
                      value={field.value}
                      onChange={field.onChange}
                      entityUsers={entityUsers}
                      isLoading={isLoadingUsers}
                      onOpenChange={handleAddUsersOpenChange}
                    />
                  )}
                />
                <div
                  className={cn(
                    "flex flex-col h-[260px] gap-2 bg-general-bg-secondary p-2.5 rounded",
                    {
                      "items-center justify-center": users.length === 0,
                    },
                  )}
                >
                  {users.length > 0 && (
                    <Input
                      placeholder="Search members"
                      value={searchQuery}
                      prefix={<Icon id="search" />}
                      onChange={(value) => setSearchQuery(value.toString())}
                    />
                  )}
                  {users.length === 0 ? (
                    <p className="body-xs-regular text-ds-text-caption">
                      No members added yet
                    </p>
                  ) : (
                    <div className="flex flex-col h-full">
                      <p className="mb-2.5 text-2xs text-ds-text-caption uppercase tracking-wide">
                        MEMBERS ({users.length})
                      </p>
                      <hr />
                      <div className="flex flex-col gap-2.5 mt-2.5 text-2xs max-h-[calc(260px-100px)] overflow-y-auto">
                        {filteredUsersList.length === 0 && searchQuery ? (
                          <p
                            role="status"
                            className="text-ds-text-caption body-xs-regular py-2"
                          >
                            No members match "{searchQuery}"
                          </p>
                        ) : (
                          filteredUsersList.map((user) => (
                            <div
                              key={user.email}
                              className="flex items-center gap-2.5 justify-between"
                            >
                              <div className="flex items-center gap-2.5 flex-1">
                                <div
                                  className="obb-avatar-user"
                                  style={{
                                    backgroundColor: user.color,
                                  }}
                                >
                                  {user.initials}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-medium text-general-label">
                                    {user.name}
                                  </span>
                                  <span className="text-ds-text-caption">
                                    {user.email}
                                  </span>
                                </div>
                              </div>
                              <Tooltip position="top" message="Remove user from role">
                                <button
                                  className="mr-3"
                                  type="button"
                                  aria-label={`Remove ${user.name || user.email} from role`}
                                  onClick={() => {
                                    const newUsers = users.filter(
                                      (email) => email !== user.email,
                                    );
                                    form.setValue("users", newUsers, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                  }}
                                >
                                  <Icon
                                    id="trash-02"
                                    className="text-ds-text-caption"
                                  />
                                </button>
                              </Tooltip>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              {mode === "edit" && (
                <Button
                  variant="danger"
                  size="sm"
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="mr-auto"
                  disabled={isSaving}
                >
                  Delete role
                </Button>
              )}
              <Button
                variant="outlined"
                size="sm"
                type="button"
                onClick={requestClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  !form.formState.isValid || !form.formState.isDirty || isSaving
                }
                size="sm"
                type="submit"
              >
                {saveLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </BaseDialog>

      <ConfirmDialog
        open={discardConfirmOpen}
        onClose={() => setDiscardConfirmOpen(false)}
        title="Discard changes?"
        description="Any unsaved changes will be lost."
        confirmButton={
          <Button variant="danger" size="sm" onClick={handleDiscard}>
            Discard
          </Button>
        }
        cancelText="Keep editing"
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete role"
        description="Are you sure you want to continue? This role will be permanently deleted."
        confirmButton={
          <Button variant="danger" size="sm" onClick={handleDelete}>
            Yes, Delete
          </Button>
        }
        cancelText="Cancel"
      />
    </>
  );
}
