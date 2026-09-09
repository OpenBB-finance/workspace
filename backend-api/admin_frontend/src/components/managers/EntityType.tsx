import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FormField, FormInput, FormSelect, useForm } from "@openbb/ui";
import { ManagerForm } from "components/formItems";
import type { SubmitFormProps } from "components/managers/Base";
import { handleRequest } from "components/managers/helpers";
import React, { useState } from "react";
import { type EntityType, addEntityType, editEntityType } from "utils/requests";
import { z } from "zod";

const entityTypeSchema = z.object({
  entityType: z.string().min(1, "This field is required"),
  code: z.string().min(1, "This field is required"),
  permissions: z.coerce.number(),
});

type TEntityType = z.infer<typeof entityTypeSchema>;

export function EntityTypeSubmitForm({
  user,
  setShowAdd,
  retrieveItems,
  data,
  item,
  setItem,
}: SubmitFormProps<EntityType, null>): JSX.Element {
  const [warning, setWarning] = useState("");

  const form = useForm<TEntityType>({
    resolver: zodResolver(entityTypeSchema),
    defaultValues: {
      entityType: item?.entity_type || "",
      code: item?.code ?? "",
      permissions: item?.permission_hierarchy ?? 0,
    },
  });

  const handleSubmit = async (values: TEntityType): Promise<void> => {
    if (item !== undefined) {
      const response = await editEntityType(
        item.uuid,
        values.entityType,
        values.code,
        values.permissions,
        user.accessToken,
      );
      await handleRequest(response, setWarning, setShowAdd, retrieveItems);
    } else {
      const response = await addEntityType(
        values.entityType,
        values.code,
        values.permissions,
        user.accessToken,
      );
      await handleRequest(response, setWarning, setShowAdd, retrieveItems);
    }
  };
  return (
    <ManagerForm onSubmit={handleSubmit} warning={warning} form={form}>
      <FormField
        name="entityType"
        control={form.control}
        render={({ field }) => {
          return <FormInput label="Entity Type" {...field} />;
        }}
      />
      <FormField
        name="code"
        control={form.control}
        render={({ field }) => {
          return <FormInput label="Code" {...field} />;
        }}
      />
      <FormField
        name="permissions"
        control={form.control}
        render={({ field }) => {
          return <FormInput label="Permissions" type="number" {...field} />;
        }}
      />
      <Button className="obb-btn-blue mt-2">Submit</Button>
    </ManagerForm>
  );
}
