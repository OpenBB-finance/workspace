import { useFormContext, useWatch } from "react-hook-form";
import { FormInput } from "~/components/ds/atoms/Input";
import { RadioGroup, RadioGroupItem } from "~/components/ds/atoms/RadioGroup";
import { Switch } from "~/components/ds/atoms/Switch";
import { FormTextarea } from "~/components/ds/atoms/TextArea";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ds/molecules/Form";
import SettingsMenu from "~/components/ds/molecules/SettingsMenu";
import type { SubmissionFormData } from "~/types/marketplaceSubmission";

/**
 * Optional MCP server section for step 02 of the marketplace submission dialog.
 *
 * Toggle OFF omits `mcp_servers` from the request, so the backend keeps
 * deriving servers from the vendor's apps.json. Only one server is editable:
 * the backend reads a single entry from the manifest and `autoAddMcpForApp`
 * only ever connects the first one.
 */
export function SubmissionMcpSection() {
  const { control, setValue, getValues } = useFormContext<SubmissionFormData>();
  const mcpEnabled = useWatch({ control, name: "mcpEnabled" });

  const setMcpEnabled = (enabled: boolean) => {
    // Seed the name from the app so the common case needs one field (the URL).
    if (enabled && !getValues("mcpName").trim()) {
      setValue("mcpName", getValues("appName"), { shouldDirty: true });
    }
    setValue("mcpEnabled", enabled, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <SettingsMenu
      title="MCP server (optional)"
      canCollapse
      open={mcpEnabled}
      onOpenChange={setMcpEnabled}
      className="overflow-visible"
      rightElement={
        <Switch
          checked={mcpEnabled}
          onCheckedChange={setMcpEnabled}
          aria-label="Enable MCP server configuration"
        />
      }
      bodyClassName="space-y-4"
    >
      <p className="body-xs-regular text-ds-text-caption">
        When off, we use whatever your apps.json declares under{" "}
        <code className="obb-code">mcp_servers</code>. Turn this on to attach a server
        here instead — it overrides the manifest for this listing.
      </p>

      <FormField
        control={control}
        name="mcpName"
        render={({ field }) => (
          <FormInput label="Server name" placeholder="e.g. Acme Research" {...field} />
        )}
      />

      <FormField
        control={control}
        name="mcpUrl"
        render={({ field }) => (
          <FormInput
            label="Server URL"
            placeholder="https://mcp.example.com/mcp"
            {...field}
          />
        )}
      />

      <FormField
        control={control}
        name="mcpDescription"
        render={({ field }) => (
          <FormTextarea
            label="Description (optional)"
            placeholder="What can users do with this server?"
            rows={2}
            {...field}
          />
        )}
      />

      <FormField
        control={control}
        name="mcpAuthType"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-2">
            <FormLabel>How users authenticate</FormLabel>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="gap-2.5"
              >
                <RadioGroupItem
                  value="oauth"
                  label="OAuth — users sign in via a popup"
                />
                <RadioGroupItem
                  value="token"
                  label="Static token — users paste an access token"
                />
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </SettingsMenu>
  );
}
