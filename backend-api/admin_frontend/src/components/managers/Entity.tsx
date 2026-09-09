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
import { type JSX, useEffect, useState } from "react";

import {
  type BaseEntity,
  type EntitlementBase,
  type Entity,
  type EntityType,
  type PostEntity,
  addEntity,
  addUser,
  editEntity,
  getEntityEntitlement,
  patchEntityEntitlement,
} from "utils/requests";
import { z } from "zod";
import { toast } from "sonner";

interface FormData {
  entityTypes: EntityType[];
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function oneYearFromToday(): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date;
}

const entitySchema = z.object({
  entityName: z.string().min(1, "This field is required"),
  code: z.string().uuid().min(1, "This field is required"),
  email: z.string().min(1, "This field is required").email("Invalid email address"),
  companyType: z.string().min(1, "This field is required"),
  organizationSize: z.string().min(1, "This field is required"),
  aum: z.coerce.number(),
  country: z.string().min(1, "This field is required"),
  seats: z.coerce.number().gte(0).lte(10000),
  expirationDate: z
    .string()
    .regex(
      /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])$/,
      "Format must be 'YYYY-MM-DD'",
    ),
  stripeId: z.string().optional(),
  // API Keys
  benzinga: z.string(),
  intrinio: z.string(),
  trading_economics: z.string(),
  fmp: z.string(),
  // Entitlements
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

const adminSchema = z.object({
  adminFirstName: z.string().min(1, "This field is required"),
  adminLastName: z.string().min(1, "This field is required"),
  adminEmail: z.string().email().min(1, "This field is required"),
});

const adminFormSchema = entitySchema.merge(adminSchema);
type TFormSchema = z.infer<typeof entitySchema>;
type TAdminSchema = z.infer<typeof adminFormSchema>;

function isAdminSchema(data: TFormSchema | TAdminSchema): data is TAdminSchema {
  return "adminEmail" in data;
}

export function EntitySubmitForm({
  user,
  setShowAdd,
  retrieveItems,
  data,
  item,
  setItem,
  editType,
}: SubmitFormProps<Entity, FormData>): JSX.Element {
  const [warning, setWarning] = useState("");
  const extras = item ? {} : { adminFirstName: "", adminLastName: "", adminEmail: "" };
  const [entitlements, setEntitlements] = useState({});
  const [updateAllUsers, setUpdateAllUsers] = useState(false);

  const expirationDate = item?.expiration_date
    ? new Date(item?.expiration_date)
    : oneYearFromToday();

  const formSchema = editType === "Add" ? adminFormSchema : entitySchema;

  const form = useForm<TFormSchema | TAdminSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entityName: item?.name || "",
      code: item?.entity_type.uuid ?? "",
      email: item?.email ?? "",
      companyType: item?.company_type ?? "",
      organizationSize: item?.organization_size ?? "",
      aum: item?.aum ?? 0,
      country: item?.country ?? "",
      seats: item?.seats ?? 1,
      expirationDate: formatDate(expirationDate),
      stripeId: item?.stripe_id ?? "",
      benzinga: item?.api_keys.benzinga ?? "",
      intrinio: item?.api_keys.intrinio ?? "",
      trading_economics: item?.api_keys.trading_economics ?? "",
      fmp: item?.api_keys.fmp ?? "",
      ...extras,
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
        const result = await getEntityEntitlement(item.uuid, user.accessToken);
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

  const handleSubmit = async (values: TFormSchema | TAdminSchema): Promise<void> => {
    let postData: PostEntity | undefined = undefined;
    const putData: BaseEntity = {
      name: values.entityName,
      entity_code: values.code,
      email: values.email,
      company_type: values.companyType,
      organization_size: values.organizationSize,
      aum: values.aum,
      country: values.country,
      seats: values.seats,
      expiration_date: values.expirationDate,
      stripe_id: values.stripeId,
      api_keys: {
        benzinga: values.benzinga,
        intrinio: values.intrinio,
        trading_economics: values.trading_economics,
        fmp: values.fmp,
      },
    };
    if (item === undefined && editType === "Add" && isAdminSchema(values)) {
      postData = {
        ...putData,
        admin_email: values.adminEmail,
      };
    }

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
      bundle_name: values.bundle_name || undefined,
    };

    if (item !== undefined) {
      const response = await editEntity(item.uuid, putData, user.accessToken);
      if (response.success) {
        toast.success("Entity updated successfully");
      } else {
        toast.error(response.message);
        await handleRequest(response, setWarning, setShowAdd, retrieveItems);
        return;
      }

      const entitlementResponse = await patchEntityEntitlement(
        item.uuid,
        entitlement,
        updateAllUsers,
        user.accessToken,
      );
      if (entitlementResponse.success) {
        await handleRequest(response, setWarning, setShowAdd, retrieveItems);
      } else {
        toast.error(entitlementResponse.message);
        await handleRequest(entitlementResponse, setWarning, setShowAdd, retrieveItems);
      }

    } else if (editType === "Add" && postData !== undefined) {
      let extraWarning = "";
      let response = await addEntity(postData, user.accessToken);
      if (response.success) {
        toast.success("Entity added successfully");
      } else {
        toast.error(response.message);
        await handleRequest(response, setWarning, setShowAdd, retrieveItems, extraWarning);
        return;
      }

      if (
        response.data !== undefined &&
        "adminEmail" in values &&
        typeof values.adminEmail === "string" &&
        "adminFirstName" in values &&
        typeof values.adminFirstName === "string" &&
        "adminLastName" in values &&
        typeof values.adminLastName === "string"
      ) {
        const addUserResponse = await addUser(
          values.adminEmail,
          response.data.permission_map_uuid,
          values.adminFirstName,
          values.adminLastName,
          user.accessToken,
        );
        if (addUserResponse.success) {
          toast.success("Admin added successfully");
        } else {
          toast.error(addUserResponse.message);
        }

        if (!addUserResponse.success) {
          extraWarning = addUserResponse.message ?? "";
        }
      }

      await handleRequest(response, setWarning, setShowAdd, retrieveItems, extraWarning);
    }
  };

  const codeOptions = data.entityTypes.map((obj) => ({
    value: obj.uuid,
    label: obj.code,
  }));

  return (
    <Tabs defaultValue="base">
      <TabsList className="mb-2 flex w-full flex-wrap gap-2 rounded border border-general-border-primary bg-general-bg-secondary p-1">
        <TabsTrigger value="base">Base</TabsTrigger>
        <TabsTrigger value="apiKeys">Api Keys</TabsTrigger>
        {editType === "Edit" && (
          <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
        )}
      </TabsList>
      <ManagerForm form={form} onSubmit={handleSubmit} warning={warning}>
        <div className="max-h-[70vh] overflow-y-auto">
          <TabsContent value="base">
            <FormField
              name="entityName"
              control={form.control}
              render={({ field }) => {
                return <FormInput label="Name" placeholder="OpenBB" {...field} />;
              }}
            />
            <FormField
              name="code"
              control={form.control}
              render={({ field }) => (
                <FormSelect
                  label="Code"
                  options={codeOptions}
                  placeholder="Select a role"
                  {...field}
                />
              )}
            />
            <FormField
              name="email"
              control={form.control}
              render={({ field }) => {
                return <FormInput label="Business Email" {...field} />;
              }}
            />
            <FormField
              name="companyType"
              control={form.control}
              render={({ field }) => {
                return <FormInput label="Company Type" {...field} />;
              }}
            />
            <FormField
              name="organizationSize"
              control={form.control}
              render={({ field }) => {
                return <FormInput label="Organization Size" {...field} />;
              }}
            />
            <FormField
              name="aum"
              control={form.control}
              render={({ field }) => {
                return <FormInput type="number" label="AUM" {...field} />;
              }}
            />
            <FormField
              name="country"
              control={form.control}
              render={({ field }) => {
                return <FormInput label="Country" {...field} />;
              }}
            />
            <FormField
              name="seats"
              control={form.control}
              render={({ field }) => {
                return <FormInput type="number" label="Seats" {...field} />;
              }}
            />
            <FormField
              name="expirationDate"
              control={form.control}
              render={({ field }) => {
                return <FormInput type="date" label="Expiration Date" {...field} />;
              }}
            />
            <FormField
              name="stripeId"
              control={form.control}
              render={({ field }) => {
                return <FormInput label="Stripe Id" {...field} />;
              }}
            />
            {item === undefined ? (
              <>
                <FormField
                  name="adminFirstName"
                  control={form.control}
                  render={({ field }) => {
                    return <FormInput label="Admin First Name" {...field} />;
                  }}
                />
                <FormField
                  name="adminLastName"
                  control={form.control}
                  render={({ field }) => {
                    return <FormInput label="Admin Last Name" {...field} />;
                  }}
                />
                <FormField
                  name="adminEmail"
                  control={form.control}
                  render={({ field }) => {
                    return <FormInput label="Admin Email" {...field} />;
                  }}
                />
              </>
            ) : (
              <></>
            )}
          </TabsContent>
          <TabsContent value="apiKeys">
            <FormField
              name="benzinga"
              control={form.control}
              render={({ field }) => {
                return <FormInput label="Benzinga" {...field} />;
              }}
            />
            <FormField
              name="intrinio"
              control={form.control}
              render={({ field }) => {
                return <FormInput label="Intrinio" {...field} />;
              }}
            />
            <FormField
              name="trading_economics"
              control={form.control}
              render={({ field }) => {
                return <FormInput label="Trading Economics" {...field} />;
              }}
            />
            <FormField
              name="fmp"
              control={form.control}
              render={({ field }) => {
                return <FormInput label="Financial Modeling Prep" {...field} />;
              }}
            />
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
                    className="mb-4" // Added padding at the bottom
                  />
                )}
              />
              <div title="If checked, this will apply the changes for all users associated with this entity">
                <Checkbox
                  label="Update All Users"
                  checked={updateAllUsers}
                  onCheckedChange={(checked: boolean) => setUpdateAllUsers(checked)}
                />
              </div>
            </TabsContent>
          ) : (
            <></>
          )}
        </div>
        <Button className="obb-btn-blue mt-2">Submit</Button>
      </ManagerForm>
    </Tabs>
  );
}
