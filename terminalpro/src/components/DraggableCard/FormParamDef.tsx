import { useCallback, useMemo, useState } from "react";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { ToggleSelect } from "~/components/ToggleSelect";
import { cleanSearchParams, convertHeadersToRecord, useJsonData } from "~/lib/api";
import { beautifySlug, cn, currentDateModifier } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import { FormInput } from "../ds/atoms/Input";
import { FormField } from "../ds/molecules/Form";
import { AdvancedSelect, type TSelectValues } from "../NewAdvancedSelect";
import Tooltip from "../Tooltip";
import type { FormInputParamDef, FormInputParamDefT } from "../types";
import { SingleDatePicker } from "../ui/SingleDatePicker";
import { useWidgetContext } from "../Widget.context";

type ParamsForm = {
  [key: string]: string;
};

export function FormParamElement() {
  const { widget, updateWidget } = useWidgetContext();
  const [isLoading, setIsLoading] = useState(false);

  const formParamDef = useMemo(() => {
    return widget?.params?.find((param) => param.type === "form");
  }, [widget?.params]);

  const initialFormValues = useMemo(() => {
    if (!formParamDef?.inputParams) return {};

    return formParamDef?.inputParams?.reduce((acc, inputParam) => {
      if (inputParam.type === "endpoint") {
        acc[inputParam.paramName] = undefined;
        return acc;
      }

      if (inputParam.type === "boolean") {
        acc[inputParam.paramName] = false;
        return acc;
      }

      if (inputParam.type === "button") {
        acc[inputParam.paramName] = undefined;
        return acc;
      }

      acc[inputParam.paramName] = inputParam.value ?? undefined;
      return acc;
    }, {});
  }, [formParamDef]);

  const form = useForm<ParamsForm>({
    defaultValues: initialFormValues,
  });

  const submitForm = useCallback(
    async (data: ParamsForm) => {
      try {
        setIsLoading(true);
        const { headers, newParams } = convertHeadersToRecord(widget.endpoint?.headers);

        const response = await fetch(formParamDef.endpoint, {
          method: formParamDef.method ?? "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        const json = await response.json();

        if (response.ok) {
          if (json.message) {
            toast.success("Success", { description: json.message, id: "form-param" });
          }
          updateWidget((prev) => ({ ...prev, refreshQuery: Date.now() }));
        } else {
          const errorMessages = [];
          if (json.message) errorMessages.push(json.message);
          if (json.error) errorMessages.push(json.error);

          const errorMessage =
            errorMessages.length > 0
              ? errorMessages.join(". ")
              : typeof json === "string"
                ? json
                : "Error submitting form data.";

          toast.error("Error", { description: errorMessage, id: "form-param" });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Error submitting form data.";
        toast.error("Error", { description: errorMessage, id: "form-param" });
      }

      setIsLoading(false);
    },
    [
      formParamDef.endpoint,
      formParamDef.method,
      widget.endpoint?.headers,
      widget.endpoint?.url,
      updateWidget,
    ],
  );

  return (
    <>
      <div className="mb-2.5">
        <h2 className="capitalize body-sm-bold">{formParamDef?.label ?? "Form"}</h2>
        {formParamDef?.description && (
          <p className="body-xs-regular mt-1 dark:text-dark-50">
            {formParamDef?.description}
          </p>
        )}
      </div>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(submitForm)}>
          <div className="mb-4">
            <div className="flex flex-col gap-4">
              {formParamDef.inputParams?.map((inputParam) => {
                if (inputParam.type === "endpoint") {
                  return (
                    <EndpointType key={inputParam.paramName} inputParam={inputParam} />
                  );
                }
                return (
                  <FormType
                    key={inputParam.paramName}
                    inputParam={inputParam}
                    isLoading={isLoading}
                  />
                );
              })}
            </div>
          </div>
        </form>
      </FormProvider>
    </>
  );
}

function EndpointType(props: { inputParam: FormInputParamDefT<"endpoint"> }) {
  const { inputParam } = props;
  const form = useFormContext<ParamsForm>();

  const endpoint = useWidgetContext()?.widget?.endpoint;

  const { paramName, label, description = [], multiSelect = false } = inputParam;

  const title = beautifySlug(label ?? paramName);

  const options = useMemo(() => {
    const { headers, newParams } = convertHeadersToRecord(endpoint?.headers ?? {});
    const url = cleanSearchParams(inputParam.optionsEndpoint, newParams);

    return {
      url: url,
      endpointHeaders: headers,
      params: newParams,
      addBearerToken: true,
    };
  }, [endpoint]);

  const { data, isLoading, error, dataUpdatedAt } = useJsonData(options, {
    enabled: true,
    staleTime: 1000 * 60 * 15,
    refetchInterval: 1000 * 60 * 15,
  });

  const { selectOptions, forceExtraInfo } = useMemo(() => {
    const paramOptions = data ?? ["Loading..."];
    if (!Array.isArray(paramOptions)) {
      const cleanUrl = inputParam?.optionsEndpoint?.split("/")?.pop();
      toast.warning("Invalid response for endpoint params.", {
        id: `invalid-endpoint-${cleanUrl}`,
        description: (
          <>
            Invalid endpoint options structure for{" "}
            <span className="font-bold">{cleanUrl}</span>.
            <div className="pt-2">
              <strong>Expected array of:</strong>
              <br />
              <div className="text-xs pl-4">
                Strings or Objects with <strong>label</strong> and{" "}
                <strong>value</strong> properties.
              </div>
            </div>
          </>
        ),
      });
      return null;
    }
    const selectOptions = paramOptions
      .map((option: TSelectValues) => {
        if (!Array.isArray(option) && typeof option !== "object") {
          return { label: option, value: option };
        }

        if (option?.label && option?.value) return option;

        return null;
      })
      .filter(Boolean);

    const forceExtraInfo = paramOptions.some((o: TSelectValues) => o?.extraInfo);

    return { selectOptions, forceExtraInfo };
  }, [inputParam.optionsEndpoint, data]);

  const selected = form.watch(paramName);

  const defaultTitle = selected?.toString() ?? title;
  const selectedLabel =
    selectOptions.find((o) => o.value === selected)?.label ?? defaultTitle;

  const toolTipMessage = (
    <div className="max-w-[296px]">
      <div className="flex justify-between gap-2">
        <div className="body-sm-bold break-words line-clamp-2">{title}</div>
      </div>
      {typeof description === "string" && (
        <div className="body-xs-regular pt-2 break-words max-h-[296px] overflow-y-auto">
          {description.split(/\n|\\\n/).map((line, idx) => {
            // Count leading spaces for indentation
            const spaces = line.match(/^ */)[0].length;
            return (
              <div
                key={`${paramName}-desc-${idx}`}
                className={cn(`pl-${Math.min(6, spaces)}`)}
              >
                {line}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      <label className="obb-label" htmlFor={inputParam.paramName}>
        {title}
      </label>
      <FormField
        name={inputParam.paramName}
        control={form.control}
        render={({ field }) => (
          <AdvancedSelect
            key={`${paramName}-${dataUpdatedAt}`}
            className="h-[34px]! obb-minimal-input"
            label={beautifySlug(
              multiSelect
                ? (Array.isArray(selected) ? selected.length > 0 : !!selected)
                  ? title
                  : ""
                : selectedLabel,
            )}
            selected={
              multiSelect
                ? Array.isArray(selected)
                  ? selected
                  : selected
                    ? [selected]
                    : []
                : selected
            }
            onSelect={(option) => {
              if (multiSelect) {
                field.onChange(
                  option ? (Array.isArray(option) ? option : [option]) : [],
                );
              } else {
                field.onChange(option);
              }
            }}
            values={selectOptions}
            toolTipMessage={toolTipMessage}
            forceSearch={true}
            forceExtraInfo={forceExtraInfo}
          />
        )}
      />
    </div>
  );
}

function FormType(props: { inputParam: FormInputParamDef; isLoading: boolean }) {
  const { inputParam, isLoading } = props;
  const form = useFormContext<ParamsForm>();
  const title = beautifySlug(inputParam.label ?? inputParam.paramName);

  if (inputParam.type === "button") {
    return (
      <div className="flex flex-col gap-1">
        <FormField
          name={inputParam.paramName}
          control={form.control}
          render={({ field }) => (
            <Tooltip message={inputParam.description ?? inputParam.label}>
              <Button
                {...field}
                variant="outlined"
                size="sm"
                loading={
                  inputParam.label?.toLocaleLowerCase()?.includes("submit")
                    ? isLoading
                    : false
                }
                onClick={() => {
                  field.onChange(inputParam.value);
                  setTimeout(() => {
                    form.setValue(inputParam.paramName, undefined);
                  }, 1000);
                }}
                className="w-full"
              >
                {inputParam.label}
              </Button>
            </Tooltip>
          )}
        />
      </div>
    );
  }

  if (inputParam.type === "number") {
    return (
      <div className="flex flex-col">
        <label className="obb-label" htmlFor={inputParam.paramName}>
          {title}
        </label>
        <FormField
          name={inputParam.paramName}
          control={form.control}
          render={({ field }) => (
            <FormInput
              type="number"
              className="h-[34px]"
              {...field}
              placeholder={inputParam.placeholder}
            />
          )}
        />
      </div>
    );
  }

  if (inputParam.type === "date") {
    return (
      <div className="flex flex-col">
        <label className="obb-label" htmlFor={inputParam.paramName}>
          {title}
        </label>
        <FormField
          name={inputParam.paramName}
          control={form.control}
          render={({ field }) => (
            <SingleDatePicker
              triggerClassName="h-[34px]"
              onSave={(date) => field.onChange(date)}
              defaultDate={currentDateModifier(field.value)}
            />
          )}
        />
      </div>
    );
  }

  if (inputParam.type === "boolean" && inputParam.options?.length === 2) {
    return (
      <div className="flex flex-col">
        <label className="obb-label" htmlFor={inputParam.paramName}>
          {title}
        </label>
        <FormField
          name={inputParam.paramName}
          control={form.control}
          render={({ field }) => (
            <ToggleSelect
              label={beautifySlug(inputParam.label ?? inputParam.paramName)}
              selected={field.value === "true"}
              onSelect={(selected) => field.onChange(selected ? "true" : "false")}
              values={[
                { label: "On", value: true },
                { label: "Off", value: false },
              ]}
              toolTipMessage={inputParam.description}
            />
          )}
        />
      </div>
    );
  }

  if (inputParam.options?.length > 0) {
    const { paramName, description = [], multiSelect = false } = inputParam;
    const selected = form.watch(paramName);

    const defaultTitle = selected?.toString() ?? title;
    const selectedLabel =
      inputParam.options.find((o) => o.value === selected)?.label ?? defaultTitle;

    const toolTipMessage = (
      <div className="max-w-[296px]">
        <div className="flex justify-between gap-2">
          <div className="body-sm-bold break-words line-clamp-2">
            {inputParam.label}
          </div>
        </div>
        {typeof description === "string" && (
          <div className="body-xs-regular pt-2 break-words max-h-[296px] overflow-y-auto">
            {description.split(/\n|\\\n/).map((line, idx) => {
              const spaces = line.match(/^ */)[0].length;
              return (
                <div
                  key={`${paramName}-desc-${idx}`}
                  className={cn(`pl-${Math.min(6, spaces)}`)}
                >
                  {line}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );

    return (
      <div className="flex flex-col">
        <label className="obb-label" htmlFor={inputParam.paramName}>
          {title}
        </label>
        <FormField
          name={inputParam.paramName}
          control={form.control}
          render={({ field }) => (
            <AdvancedSelect
              className="h-[34px]! obb-minimal-input"
              label={beautifySlug(
                multiSelect
                  ? (
                      Array.isArray(field.value)
                        ? field.value.length > 0
                        : !!field.value
                    )
                    ? title
                    : ""
                  : selectedLabel,
              )}
              selected={
                multiSelect
                  ? Array.isArray(field.value)
                    ? field.value
                    : field.value
                      ? [field.value]
                      : []
                  : field.value
              }
              onSelect={(option) => {
                if (multiSelect) {
                  field.onChange(
                    option ? (Array.isArray(option) ? option : [option]) : [],
                  );
                } else {
                  field.onChange(option);
                }
              }}
              values={inputParam.options}
              toolTipMessage={toolTipMessage}
              forceSearch={inputParam.options.length > 10}
            />
          )}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <label className="obb-label" htmlFor={inputParam.paramName}>
        {title}
      </label>
      <FormField
        name={inputParam.paramName}
        control={form.control}
        render={({ field }) => (
          <FormInput
            {...field}
            placeholder={inputParam.placeholder}
            className="h-[34px]"
          />
        )}
      />
    </div>
  );
}
