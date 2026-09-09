import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FormField, FormInput, FormSelect, useForm } from "@openbb/ui";
import { ManagerForm } from "components/formItems";
import type { SubmitFormProps } from "components/managers/Base";
import { handleRequest } from "components/managers/helpers";
import React, { useState } from "react";
import {
  type Entitlements,
  type Entity,
  type PermissionMap,
  addPermissionMap,
  editPermissionMap,
} from "utils/requests";
import { z } from "zod";

interface FormData {
  entities: Entity[];
}

const sources = [
  "benzinga",
  "polygon",
  "intrinio",
  "fmp",
  "datarade",
  "veraset",
  "alphavantage",
] as const;
export type Sources = (typeof sources)[number];

const permissionsSchema = z.object({
  name: z.string().min(1, "This field is required"),
  entity: z.string().uuid().min(1, "This field is required"),
  benzinga: z.enum(["None", "Read", "Write"]),
  polygon: z.enum(["None", "Read", "Write"]),
  intrinio: z.enum(["None", "Read", "Write"]),
  fmp: z.enum(["None", "Read", "Write"]),
  datarade: z.enum(["None", "Read", "Write"]),
  veraset: z.enum(["None", "Read", "Write"]),
  alphavantage: z.enum(["None", "Read", "Write"]),
});
type TPermissionsSchema = z.infer<typeof permissionsSchema>;

export function PermissionsMapSubmitForm({
  user,
  setShowAdd,
  retrieveItems,
  data,
  item,
  setItem,
}: SubmitFormProps<PermissionMap, FormData>): JSX.Element {
  const [warning, setWarning] = useState("");

  const form = useForm<TPermissionsSchema>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: {
      name: item?.name || "",
      entity: item?.entity.uuid ?? "",
      benzinga: item?.entitlements?.benzinga ?? "None",
      polygon: item?.entitlements?.polygon ?? "None",
      intrinio: item?.entitlements?.intrinio ?? "None",
      fmp: item?.entitlements?.fmp ?? "None",
      datarade: item?.entitlements?.datarade ?? "None",
      veraset: item?.entitlements?.veraset ?? "None",
      alphavantage: item?.entitlements?.alphavantage ?? "None",
    },
  });

  const handleSubmit = async (values: TPermissionsSchema): Promise<void> => {
    const entitlements = {
      benzinga: values.benzinga,
      polygon: values.polygon,
      intrinio: values.intrinio,
      fmp: values.fmp,
      datarade: values.datarade,
      veraset: values.veraset,
      alphavantage: values.alphavantage,
    };
    if (item !== undefined) {
      const response = await editPermissionMap(
        item.uuid,
        values.entity,
        values.name,
        entitlements,
        user.accessToken,
      );
      await handleRequest(response, setWarning, setShowAdd, retrieveItems);
    } else {
      const response = await addPermissionMap(
        values.entity,
        values.name,
        entitlements,
        user.accessToken,
      );
      await handleRequest(response, setWarning, setShowAdd, retrieveItems);
    }
  };

  const entityOptions = data.entities.map((obj) => ({
    value: obj.uuid,
    label: obj.name,
  }));

  return (
    <ManagerForm onSubmit={handleSubmit} warning={warning} form={form}>
      <FormField
        name="entity"
        control={form.control}
        render={({ field }) => (
          <FormSelect label="Entity" options={entityOptions} {...field} />
        )}
      />
      <FormField
        name="name"
        control={form.control}
        render={({ field }) => {
          return <FormInput label="Name" {...field} />;
        }}
      />
      <>
        {sources.map((name: Sources) => (
          <FormField
            key={name}
            name={name}
            control={form.control}
            render={({ field }) => (
              <FormSelect
                label={name}
                options={["None", "Read", "Write"]}
                placeholder="Select a role"
                {...field}
              />
            )}
          />
        ))}
      </>
      <Button className="obb-btn-blue mt-2">Submit</Button>
    </ManagerForm>
  );
}
