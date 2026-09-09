import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Button } from "~/components/ds/atoms/Button";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { FormInput } from "~/components/ds/atoms/Input";
import { RadioGroup, RadioGroupItem } from "~/components/ds/atoms/RadioGroup";
import { Switch } from "~/components/ds/atoms/Switch";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ds/molecules/Form";
import SettingsMenu from "~/components/ds/molecules/SettingsMenu";
import Icon from "~/components/Icon";
import type { SubmissionFormData } from "~/types/marketplaceSubmission";
import { deriveAuthFieldId } from "./submissionAuth";

const EMPTY_AUTH_ROW = { label: "", key: "", prefix: "" };

/** Repeatable custom auth header rows — horizontal layout matching the Connect a backend dialog. */
function AuthFieldRows() {
  const { control } = useFormContext<SubmissionFormData>();
  const { fields, append, remove } = useFieldArray({ control, name: "authFields" });

  return (
    <FormField
      control={control}
      name="authFields"
      render={({ fieldState: { error } }) => {
        const message = error?.message || error?.root?.message;
        const arrayMessage = typeof message === "string" ? message : undefined;
        return (
          <FormItem className="flex flex-col gap-1.5">
            <FormLabel>Custom auth fields</FormLabel>
            <div className="flex flex-col gap-2">
              {fields.map((row, i) => (
                <div key={row.id} className="flex gap-2 items-end w-full">
                  <div className="flex-1">
                    <FormField
                      control={control}
                      name={`authFields.${i}.label`}
                      render={({ field }) => {
                        const derivedId = deriveAuthFieldId(field.value);
                        return (
                          <FormInput
                            label="Label"
                            placeholder="e.g. API Key"
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            message={
                              derivedId ? (
                                <span className="text-ds-text-caption">
                                  Id: {derivedId}
                                </span>
                              ) : undefined
                            }
                          />
                        );
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <FormField
                      control={control}
                      name={`authFields.${i}.key`}
                      render={({ field }) => (
                        <FormInput
                          label="Header key"
                          placeholder="e.g. Authorization"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <FormField
                      control={control}
                      name={`authFields.${i}.prefix`}
                      render={({ field }) => (
                        <FormInput
                          label="Prefix (optional)"
                          placeholder="e.g. Bearer "
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      )}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="mb-2"
                    aria-label="Remove field"
                  >
                    <Icon
                      id="circled-cross-icon"
                      className="h-4 w-4 text-ds-text-caption hover:text-ds-text-body transition-colors"
                    />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outlined"
              size="sm"
              className="self-start"
              onClick={() => append(EMPTY_AUTH_ROW)}
            >
              <Icon id="plus-icon" className="h-4 w-4 mr-1" />
              Add field
            </Button>
            <p className="body-xs-regular text-ds-text-caption">
              Users enter these credentials when connecting your app. Field ids are
              derived from each label.
            </p>
            {arrayMessage && (
              <p className="body-xs-regular text-alert-error">{arrayMessage}</p>
            )}
          </FormItem>
        );
      }}
    />
  );
}

/**
 * Optional authentication section for step 02 of the marketplace submission
 * dialog. Toggle OFF omits auth keys from the request (backend default preserved).
 */
export function SubmissionAuthSection() {
  const { control, setValue, getValues } = useFormContext<SubmissionFormData>();
  const [authEnabled, authMode] = useWatch({
    control,
    name: ["authEnabled", "authMode"],
  });

  const setAuthEnabled = (enabled: boolean) => {
    setValue("authEnabled", enabled, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <SettingsMenu
      title="Authentication (optional)"
      canCollapse
      open={authEnabled}
      onOpenChange={setAuthEnabled}
      className="overflow-visible"
      rightElement={
        <Switch
          checked={authEnabled}
          onCheckedChange={setAuthEnabled}
          aria-label="Enable authentication configuration"
        />
      }
      bodyClassName="space-y-4"
    >
      <p className="body-xs-regular text-ds-text-caption">
        When off, users are asked for a single API key (the marketplace default). Turn
        this on to declare a different auth strategy for your listing.
      </p>

      <FormField
        control={control}
        name="authMode"
        render={({ field }) => (
          <FormItem className="flex flex-col gap-2">
            <FormLabel>Authentication type</FormLabel>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  if (value === "custom" && getValues("authFields").length === 0) {
                    setValue("authFields", [{ ...EMPTY_AUTH_ROW }], {
                      shouldDirty: true,
                    });
                  }
                }}
                className="gap-2.5"
              >
                <RadioGroupItem value="api_key" label="API key" />
                <RadioGroupItem value="custom" label="Custom headers" />
                <RadioGroupItem value="none" label="No authentication" />
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {authMode !== "none" && (
        <FormField
          control={control}
          name="authAllowAnonymous"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  label="Also allow anonymous access"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {authMode === "custom" && <AuthFieldRows />}
    </SettingsMenu>
  );
}
