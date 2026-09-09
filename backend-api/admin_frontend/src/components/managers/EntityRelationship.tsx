import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FormField, FormInput, FormSelect, useForm } from "@openbb/ui";
import { ManagerForm } from "components/formItems";
import type { SubmitFormProps } from "components/managers/Base";
import { handleRequest } from "components/managers/helpers";
import React, { useState } from "react";
import {
  type Entity,
  type EntityRelationship,
  addEntityRelationship,
  editEntityRelationship,
} from "utils/requests";
import { z } from "zod";

interface FormData {
  entities: Entity[];
}

const entityRelationshipSchema = z.object({
  parent: z.string().uuid().min(1, "This field is required"),
  child: z.string().uuid().min(1, "This field is required"),
});
type TEntityRelationship = z.infer<typeof entityRelationshipSchema>;

export function EntityRelationshipSubmitForm({
  user,
  setShowAdd,
  retrieveItems,
  data,
  item,
  setItem,
}: SubmitFormProps<EntityRelationship, FormData>): JSX.Element {
  const [warning, setWarning] = useState("");

  const theOptions = data.entities.map((obj) => ({ value: obj.uuid, label: obj.name }));
  const form = useForm<TEntityRelationship>({
    resolver: zodResolver(entityRelationshipSchema),
    defaultValues: {
      parent: item?.parent.uuid ?? "",
      child: item?.child.uuid ?? "",
    },
  });

  const handleSubmit = async (values: TEntityRelationship): Promise<void> => {
    if (item !== undefined) {
      const response = await editEntityRelationship(
        item.uuid,
        values.parent,
        values.child,
        user.accessToken,
      );
      await handleRequest(response, setWarning, setShowAdd, retrieveItems);
    } else {
      const response = await addEntityRelationship(
        values.parent,
        values.child,
        user.accessToken,
      );
      await handleRequest(response, setWarning, setShowAdd, retrieveItems);
    }
  };
  return (
    <ManagerForm onSubmit={handleSubmit} warning={warning} form={form}>
      <FormField
        name="parent"
        control={form.control}
        render={({ field }) => (
          <FormSelect label="Parent" options={theOptions} {...field} />
        )}
      />
      <FormField
        name="child"
        control={form.control}
        render={({ field }) => (
          <FormSelect
            label="Child"
            options={theOptions}
            placeholder="Select a role"
            {...field}
          />
        )}
      />
      <Button className="obb-btn-blue mt-2">Submit</Button>
    </ManagerForm>
  );
}
