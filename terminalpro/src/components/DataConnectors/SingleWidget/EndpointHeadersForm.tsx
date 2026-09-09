import { forwardRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormSelect } from "~/components/ds/atoms/Select";
import { FormField } from "~/components/ds/molecules/Form";
import Icon from "~/components/Icon";
import type { McpServerSchema } from "~/components/McpServerModal";
import type { AdvancedForm } from "../AdvancedWidgetDialog";
import type { SingleWidgetFormT } from "./types";

type EndpointHeaderProps = {
  connectionType?: "single" | "advanced";
  name?: "endpointHeaders" | "customHeaders";
};
export const EndpointHeadersForm = forwardRef<HTMLFormElement, EndpointHeaderProps>(
  ({ connectionType = "single", name = "endpointHeaders" }, _ref) => {
    const form = useFormContext<SingleWidgetFormT | AdvancedForm | McpServerSchema>();

    const headers = useWatch({ control: form.control, name });

    return (
      <label className="flex flex-col gap-2 w-full">
        {(headers || []).map((_, index) => (
          <div key={index} className="flex gap-2 items-center w-full">
            <div className="flex-1">
              <FormField
                name={`${name}.${index}.key`}
                control={form.control}
                render={({ field }) => (
                  <FormInput label="Key" placeholder="Key" {...field} className="" />
                )}
              />
            </div>
            <div className="flex-1">
              <FormField
                name={`${name}.${index}.value`}
                control={form.control}
                render={({ field }) => (
                  <FormInput
                    label="Value"
                    placeholder="Value"
                    {...field}
                    className=""
                  />
                )}
              />
            </div>
            {connectionType === "advanced" && (
              <div className="flex-1 mt-1">
                <FormField
                  name={`endpointHeaders.${index}.location`}
                  control={form.control}
                  render={({ field }) => (
                    <FormSelect
                      label="Location"
                      options={[
                        { label: "Header", value: "headers" },
                        { label: "Query Parameter", value: "query" },
                      ]}
                      {...field}
                      className=""
                    />
                  )}
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                form.setValue(
                  name,
                  (form.getValues(name) || []).filter((_, i) => i !== index),
                  { shouldDirty: true },
                );
                form.trigger(name);
              }}
              className="mt-6"
            >
              <Icon
                id="circled-cross-icon"
                className="h-4 w-4 text-light-600 dark:text-light-300"
              />
            </button>
          </div>
        ))}
      </label>
    );
  },
);
