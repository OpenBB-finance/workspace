import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Checkbox,
  FormField,
  FormInput,
  FormSelect,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useForm,
} from "@openbb/ui";
import { ManagerForm } from "components/formItems";
import type { SubmitFormProps } from "components/managers/Base";
import { handleRequest } from "components/managers/helpers";
import type React from "react";
import { useEffect, useState } from "react";
import {
  type EntitlementBase,
  type FullUser,
  type PermissionMap,
  addUser,
  editUser,
  getAdminUserEntitlement,
  patchAdminUserEntitlement,
} from "utils/requests";
import { z } from "zod";
import { toast } from "sonner";

interface FormData {
  permissionMaps: PermissionMap[];
}

const userSchema = z.object({
  pro_trial_end: z.coerce.date().optional(),
  email: z.string().email().min(1, "This field is required"),
  permissions: z.string().uuid().min(1, "This field is required"),
  // Entitlement fields
  tier: z.enum(["pro", "terminal"]).optional(),
  number_copilot_calls_day: z.coerce.number().optional(),
  total_file_upload_size_gb: z.coerce.number().optional(),
  share_widgets: z.enum(["public", "private"]).optional(),
  bring_your_own_data: z.boolean().optional(),
  bring_your_own_copilot: z.boolean().optional(),
  admin_access: z.boolean().optional(),
  support: z.boolean().optional(),
  excel_add_in: z.boolean().optional(),
  data_add_ons_redistribution: z.boolean().optional(),
  bundle_name: z
    .enum(["Default", "Equity Research", "Pro Trial"])
    .nullable()
    .optional(),
});
type TUserSchema = z.infer<typeof userSchema>;

export function UserSubmitForm({
  user,
  setShowAdd,
  retrieveItems,
  data,
  item,
  setItem,
  editType,
}: SubmitFormProps<FullUser, FormData>): JSX.Element {
  const [warning, setWarning] = useState("");
  const [entitlements, setEntitlements] = useState({});
  const [activeTab, setActiveTab] = useState("base");

  const form = useForm<TUserSchema>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: item?.email ?? "",
      permissions: item?.permissions?.uuid ?? "",
      pro_trial_end: item?.pro_trial_end ? new Date(item.pro_trial_end) : undefined,
    },
  });

  useEffect(() => {
    if (form.formState.errors && Object.keys(form.formState.errors).length > 0) {
      setWarning(`Form validation errors: ${JSON.stringify(form.formState.errors)}`);
    }
  }, [form.formState]);

  useEffect(() => {
    const fetchEntitlements = async () => {
      if (item) {
        const result = await getAdminUserEntitlement(item.uuid, user.accessToken);
        setEntitlements(result);
      }
    };
    fetchEntitlements();
  }, [item, user.accessToken]);

  useEffect(() => {
    if (Object.keys(entitlements).length > 0) {
      form.reset({
        ...form.getValues(),
        ...entitlements,
      });
    }
  }, [entitlements, form]);

  useEffect(() => {
    if(editType === "Edit"){
      const permissions = form.getValues().permissions;
      const currentProTrialEnd = form.getValues().pro_trial_end || null;

      // Get the selected permission's label
      const selectedPermission = getOptions().find(opt => opt.value === permissions)?.label;

      if (selectedPermission?.includes("OpenBB Trial") && currentProTrialEnd === null) {
        const threeWeeksFromNow = new Date();
        threeWeeksFromNow.setDate(threeWeeksFromNow.getDate() + 21);
        form.setValue('pro_trial_end', threeWeeksFromNow);
      }
    }
  }, [form.watch('permissions')]);

  const handleSubmit = async (values: TUserSchema): Promise<void> => {
    if (item !== undefined) {
      if (activeTab === "base") {
        const response = await editUser(
          item.uuid,
          values.permissions,
          values.pro_trial_end,
          user.accessToken,
        );
        if (response.success) {
          toast.success("User updated successfully");
        } else {
          toast.error(response.message);
        }
        await handleRequest(response, setWarning, setShowAdd, retrieveItems);
      } else if (activeTab === "entitlements") {
        const entitlement: EntitlementBase = {
          tier: values.tier,
          number_copilot_calls_day: values.number_copilot_calls_day,
          total_file_upload_size_gb: values.total_file_upload_size_gb,
          share_widgets: values.share_widgets,
          bring_your_own_data: values.bring_your_own_data,
          bring_your_own_copilot: values.bring_your_own_copilot,
          admin_access: values.admin_access,
          support: values.support,
          excel_add_in: values.excel_add_in,
          data_add_ons_redistribution: values.data_add_ons_redistribution,
          bundle_name: values.bundle_name,
        };
        const entitlementResponse = await patchAdminUserEntitlement(
          item.uuid,
          entitlement,
          user.accessToken,
        );
        if (entitlementResponse.success) {
          toast.success("User entitlements updated successfully");
        } else {
          toast.error(entitlementResponse.message);
        }
        await handleRequest(entitlementResponse, setWarning, setShowAdd, retrieveItems);
      }
    } else {
      const response = await addUser(
        values.email,
        values.permissions,
        null,
        null,
        user.accessToken,
      );
      if (response.success) {
        toast.success("User added successfully");
      } else {
        toast.error(response.message);
      }
      await handleRequest(response, setWarning, setShowAdd, retrieveItems);
    }
  };

  function getOptions(): { value: string; label: string }[] {
    const options = data.permissionMaps.map((obj) => ({
      value: obj.uuid,
      label: `${obj?.entity?.name}-${obj?.name}`,
    }));
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }

  return (
    <Tabs defaultValue="base" onValueChange={setActiveTab}>
      <TabsList className="mb-2 flex w-full gap-2 rounded border border-general-border-primary bg-general-bg-secondary p-1">
        <TabsTrigger value="base">Base</TabsTrigger>
        {editType === "Edit" && (
          <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
        )}
      </TabsList>
      <ManagerForm form={form} onSubmit={handleSubmit} warning={warning}>
        <TabsContent value="base">
          <FormField
            name="email"
            control={form.control}
            render={({ field }) => {
              return <FormInput label="email" {...field} />;
            }}
          />
          <FormField
            name="permissions"
            control={form.control}
            render={({ field }) => (
              <FormSelect label="Permissions" options={getOptions()} {...field} />
            )}
          />
          {editType === "Edit" && (
            <FormField
              name="pro_trial_end"
              control={form.control}
              render={({ field }) => {
                const dateValue = field.value ? new Date(field.value) : undefined;
                return (
                  <FormInput
                    type="date"
                    label="Pro Trial End"
                    {...field}
                    value={
                      dateValue && !Number.isNaN(dateValue.getTime())
                        ? dateValue.toISOString().split("T")[0]
                        : ""
                    }
                  />
                );
              }}
            />
          )}
        </TabsContent>
        {editType === "Edit" ? (
          <TabsContent value="entitlements">
            <FormField
              name="tier"
              control={form.control}
              render={({ field }) => {
                return (
                  <FormSelect
                    options={[
                      { value: "pro", label: "Pro" },
                      { value: "terminal", label: "Terminal" },
                    ]}
                    label="Tier"
                    {...field}
                  />
                );
              }}
            />
            <FormField
              name="number_copilot_calls_day"
              control={form.control}
              render={({ field }) => {
                return (
                  <FormInput
                    type="number"
                    label="Number of Copilot Calls per Day"
                    {...field}
                  />
                );
              }}
            />
            <FormField
              name="total_file_upload_size_gb"
              control={form.control}
              render={({ field }) => {
                return (
                  <FormInput
                    type="number"
                    label="Total File Upload Size (GB)"
                    {...field}
                  />
                );
              }}
            />
            <FormField
              name="share_widgets"
              control={form.control}
              render={({ field }) => {
                return (
                  <FormSelect
                    options={[
                      { value: "public", label: "Public" },
                      { value: "private", label: "Private" },
                    ]}
                    label="Share Widgets"
                    {...field}
                  />
                );
              }}
            />
            <FormField
              name="bring_your_own_data"
              control={form.control}
              render={({ field }) => {
                return (
                  <Checkbox
                    label="Bring Your Own Data"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                );
              }}
            />
            <FormField
              name="bring_your_own_copilot"
              control={form.control}
              render={({ field }) => {
                return (
                  <Checkbox
                    label="Bring Your Own Copilot"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                );
              }}
            />
            <FormField
              name="admin_access"
              control={form.control}
              render={({ field }) => {
                return (
                  <Checkbox
                    label="Admin Access"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                );
              }}
            />
            <FormField
              name="support"
              control={form.control}
              render={({ field }) => {
                return (
                  <Checkbox
                    label="Support"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                );
              }}
            />
            <FormField
              name="excel_add_in"
              control={form.control}
              render={({ field }) => {
                return (
                  <Checkbox
                    label="Excel Add-In"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                );
              }}
            />
            <FormField
              name="data_add_ons_redistribution"
              control={form.control}
              render={({ field }) => {
                return (
                  <Checkbox
                    label="Data Add-Ons Redistribution"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                );
              }}
            />
            <FormField
              name="bundle_name"
              control={form.control}
              render={({ field }) => (
                <FormSelect
                  options={[
                    { value: "Default", label: "Default" },
                    { value: "Equity Research", label: "Equity Research" },
                    { value: "Pro Trial", label: "Pro Trial" },
                  ]}
                  label="Bundle Name"
                  {...field}
                  value={field.value ?? undefined}
                />
              )}
            />
          </TabsContent>
        ) : (
          <></>
        )}
        <Button className="obb-btn-blue mt-2">
          {activeTab === "base" ? "Submit Base Info" : "Submit Entitlements"}
        </Button>
      </ManagerForm>
    </Tabs>
  );
}

export function UserSearchBar({
  retrieveItems,
}: { retrieveItems: (email?: string) => Promise<void> }): JSX.Element {
  const [email, setEmail] = useState("");

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    await retrieveItems(email);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
        }}
        className="h-8 rounded border border-general-border-primary bg-input-bg px-3 text-xs text-ds-text-body focus:outline-none"
        placeholder="Search by user email"
      />
      <Button className="obb-btn">Search</Button>
    </form>
  );
}
