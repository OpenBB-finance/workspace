import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type JSX, useCallback, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createUser, inviteUser } from "~/api/admin.api";
import { getEntityRoles } from "~/api/entity_roles.api";
import AdminDialogFooter from "~/components/AdminUsers/common/AdminDialogFooter";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormSelect } from "~/components/ds/atoms/Select";
import { Form, FormField } from "~/components/ds/molecules/Form";
import { TabsContent } from "~/components/ds/molecules/Tabs";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { isLiteEnvironment } from "~/lib/onPremFeatureFlags";
import { getConfig } from "~/lib/runtimeConfig";
import type { CreateUserDTO } from "~/types/user.type";

const servicesEmailFF = getConfig().services.email;
const isLite = isLiteEnvironment();

const userFormSchemaBase = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  bypass_invitation: z.boolean(),
  role: z.string().nullish(),
});

export type TUserForm = z.infer<typeof userFormSchemaBase>;

export default function InviteSingleUser({
  permissions,
  onClose,
}: {
  permissions: string;
  onClose: () => void;
}) {
  const userFormRef = useRef<HTMLFormElement>(null);
  const [errorMessage, setErrorMessage] = useState<null | string>(null);

  const queryClient = useQueryClient();

  // Fetch roles from the API
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["roles"],
    enabled: true,
    queryFn: getEntityRoles,
    staleTime: 1000 * 60 * 5,
  });

  // Transform roles data for the dropdown
  const roleOptions = useMemo(
    () => roles.map((role) => ({ label: role.name, value: role.uuid })),
    [roles],
  );

  const userForm = useForm<TUserForm>({
    resolver: zodResolver(userFormSchemaBase),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      role: "",
      bypass_invitation: isLite || !servicesEmailFF,
    },
  });

  const handleSubmit = useCallback(
    async (values: TUserForm) => {
      const dto: CreateUserDTO = {
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        permissions_uuid: permissions,
        role: values.role || null,
      };
      try {
        let toast_msg: string;
        let toast_description: string | JSX.Element;
        let res: any;
        if (values.bypass_invitation) {
          const { success, temporary_password } = await createUser(dto);
          res = { success, temporary_password };
          if (import.meta.env.DEV) {
            console.log("success: ", success);
          }
          toast_msg = "User added";
          toast_description = (
            <div className="flex flex-col gap-2">
              <p>
                User {values.first_name} {values.last_name} has been added to the
                organization.
              </p>
              <div className="flex items-center gap-2">
                <span>Temporary password: {temporary_password}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(temporary_password);
                    toast.success("Password copied to clipboard");
                  }}
                  className="hover:text-primary-500"
                >
                  <Icon id="clipboard-icon" className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        } else {
          res = await inviteUser(dto);
          toast_msg = "User invited";
          toast_description = `User ${values.first_name} ${values.last_name} has been invited.`;
        }
        if (res.success) {
          toast.success(toast_msg, {
            description: toast_description,
          });
          queryClient.refetchQueries({ queryKey: ["admin", "users"] });
          queryClient.refetchQueries({ queryKey: ["admin", "entityInfo"] });
          queryClient.refetchQueries({ queryKey: ["roles"] });
          onClose();
        }
      } catch (error) {
        const data = error.response.data;
        setErrorMessage(data.detail || "Unable to register the user");
        return;
      }
    },
    [onClose, permissions, queryClient.refetchQueries],
  );

  return (
    <TabsContent value="single">
      <Form {...userForm}>
        <form ref={userFormRef} onSubmit={userForm.handleSubmit(handleSubmit)}>
          <div className="space-y-6 pb-2">
            <FormField
              name="first_name"
              control={userForm.control}
              render={({ field }) => <FormInput label="First name" {...field} />}
            />
            <FormField
              name="last_name"
              control={userForm.control}
              render={({ field }) => <FormInput label="Last name" {...field} />}
            />
            <FormField
              name="email"
              control={userForm.control}
              render={({ field }) => <FormInput label="Email address" {...field} />}
            />
            {roleOptions.length > 0 && (
              <FormField
                name="role"
                control={userForm.control}
                render={({ field }) => (
                  <FormSelect
                    label="Role (Optional)"
                    placeholder="Select a role"
                    options={roleOptions}
                    {...field}
                  />
                )}
              />
            )}
            {!isLite && (
              <FormField
                name="bypass_invitation"
                control={userForm.control}
                render={({ field }) => (
                  <div className="flex items-center gap-1.5 pb-6">
                    <Checkbox
                      label="Bypass invitation"
                      className="text-ds-text-caption"
                      labelClassName="max-w-none whitespace-nowrap ml-1"
                      checked={!servicesEmailFF || field.value}
                      onCheckedChange={servicesEmailFF ? field.onChange : undefined}
                      disabled={!servicesEmailFF}
                    />
                    <Tooltip
                      message={
                        servicesEmailFF
                          ? "By selecting this option, the user will be added to the organization without the need to accept an invitation."
                          : "Email service is disabled. Users will be added directly without invitation emails."
                      }
                      position="top"
                    >
                      <button type="button" className="inline-flex">
                        <Icon
                          id="help-outline-circle"
                          className="text-ds-text-caption"
                        />
                      </button>
                    </Tooltip>
                  </div>
                )}
              />
            )}
          </div>
          {errorMessage && <p className="text-alert-error pb-6">{errorMessage}</p>}
          <AdminDialogFooter
            primaryButtonName={
              userForm.watch("bypass_invitation") || !servicesEmailFF ? "Add" : "Invite"
            }
            className="pr-0"
            primaryButtonDisabled={!userForm.formState.isValid}
          />
        </form>
      </Form>
    </TabsContent>
  );
}
