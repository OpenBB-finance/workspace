import { zodResolver } from "@hookform/resolvers/zod";
import { Button, FormField, FormInput, FormSelect, useForm } from "@openbb/ui";
import { ManagerForm } from "components/formItems";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type AuthStore, useAuthStore } from "utils/auth";
import { addInstaller } from "utils/requests";
import { z } from "zod";

const systems: { value: string; label: string }[] = [
  { value: "darwin-aarch64", label: "M1 Mac" },
  { value: "darwin-x86_64", label: "Intel Mac" },
  { value: "windows-x86_64", label: "Windows" },
];

const itemTypes: { value: string; label: string }[] = [
  { value: "installer", label: "Installer" },
  { value: "updater", label: "Updater" },
];

const installerSchema = z.object({
  objectName: z.string().min(1, "This field is required"),
  version: z.string().min(1, "This field is required"),
  system: z.enum(["darwin-aarch64", "darwin-x86_64", "windows-x86_64"]),
  notes: z.string().min(1, "This field is required"),
  type: z.enum(["installer", "updater"]),
  signature: z.string().optional(),
});
type TInstallerSchema = z.infer<typeof installerSchema>;

export default function AddInstaller(): JSX.Element {
  const user = useAuthStore((state: AuthStore) => state.user);
  const [warning, setWarning] = useState("");
  const navigate = useNavigate();

  const form = useForm<TInstallerSchema>({
    resolver: zodResolver(installerSchema),
    defaultValues: {
      objectName: "",
      version: "",
      system: "windows-x86_64",
      notes: "",
      type: "installer",
    },
  });

  const handleSubmit = async (values: TInstallerSchema): Promise<void> => {
    if (user !== null) {
      const response = await addInstaller(
        values.objectName,
        values.version,
        values.system,
        values.notes,
        values.type,
        values.signature ?? "",
        user.accessToken,
      );
      if (response.success) {
        navigate("/home");
      } else {
        setWarning(response.message ?? "");
      }
    }
  };
  const itemType = form.watch("type");

  return (
    <div className="obb-page-container">
      <div className="mb-4">
        <h1 className="obb-admin-title">Publish Installer</h1>
        <p className="obb-admin-subtitle">
          Upload installer metadata for desktop distribution channels.
        </p>
      </div>
      <ManagerForm onSubmit={handleSubmit} warning={warning} form={form}>
        <FormField
          name="objectName"
          control={form.control}
          render={({ field }) => {
            return <FormInput label="Object Name" {...field} />;
          }}
        />
        <FormField
          name="version"
          control={form.control}
          render={({ field }) => {
            return <FormInput label="Version" {...field} />;
          }}
        />
        <FormField
          name="system"
          control={form.control}
          render={({ field }) => (
            <FormSelect
              label="System"
              options={systems}
              placeholder="Select a system"
              {...field}
            />
          )}
        />
        <FormField
          name="notes"
          control={form.control}
          render={({ field }) => {
            return <FormInput label="Notes" type="textarea" {...field} />;
          }}
        />
        <FormField
          name="type"
          control={form.control}
          render={({ field }) => (
            <FormSelect
              label="Type"
              options={itemTypes}
              placeholder="Select an item type"
              {...field}
            />
          )}
        />
        {itemType === "updater" ? (
          <FormField
            name="signature"
            control={form.control}
            render={({ field }) => {
              return <FormInput label="Signature" {...field} />;
            }}
          />
        ) : (
          <></>
        )}
        <Button className="obb-btn-blue mt-2">Submit</Button>
      </ManagerForm>
    </div>
  );
}
