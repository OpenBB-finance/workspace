import { memo } from "react";
import DebouncedInput from "~/components/General/Table/DebouncedInput";
import { AdvancedSelect } from "~/components/NewAdvancedSelect";
import { ToggleSelect } from "~/components/ToggleSelect";
import { SingleDatePicker } from "~/components/ui/SingleDatePicker";
import type { OpenBBParamDef } from "~/types/iframeProtocol";

interface IframeParamControlsProps {
  paramDefs: OpenBBParamDef[];
  values: Record<string, string>;
  onChange: (paramName: string, value: string) => void;
}

export const IframeParamControls = memo(
  ({ paramDefs, values, onChange }: IframeParamControlsProps) => {
    return (
      <div className="flex items-center gap-1.5 min-w-fit">
        {paramDefs.map((param) => (
          <IframeParamControl
            key={param.paramName}
            param={param}
            value={values[param.paramName] ?? param.value ?? ""}
            onChange={(value) => onChange(param.paramName, value)}
          />
        ))}
      </div>
    );
  },
);

const IframeParamControl = memo(
  ({
    param,
    value,
    onChange,
  }: {
    param: OpenBBParamDef;
    value: string;
    onChange: (value: string) => void;
  }) => {
    const toolTipMessage = param.description ?? param.label ?? param.paramName;

    if (param.type === "boolean") {
      return (
        <div className="obb-parameter flex items-center h-[20px]">
          <ToggleSelect
            key={`toggle-${param.paramName}`}
            className="w-fit min-w-[96px]"
            label={param.label ?? param.paramName}
            selected={value.toLowerCase() === "true"}
            onSelect={(selected) => onChange(selected ? "true" : "false")}
            values={[
              { label: "On", value: true },
              { label: "Off", value: false },
            ]}
            toolTipMessage={toolTipMessage}
          />
        </div>
      );
    }

    if (param.type === "date") {
      return (
        <div className="obb-parameter flex items-center h-[20px] pr-0.5">
          <SingleDatePicker
            key={`datepicker-${param.paramName}`}
            triggerClassName=""
            defaultDate={value}
            onSave={(date) => onChange(date ?? "")}
            toolTipProps={{
              message: toolTipMessage,
              position: "top",
              delayDuration: 300,
            }}
          />
        </div>
      );
    }

    if (param.options && param.options.length > 0) {
      const selectedLabel =
        param.options.find((o) => o.value === value)?.label ?? value;

      return (
        <AdvancedSelect
          key={`select-${param.paramName}`}
          label={selectedLabel}
          selected={value}
          onSelect={(val) => onChange(val as string)}
          values={param.options as { label: string; value: string }[]}
          toolTipMessage={toolTipMessage}
          forceSearch={param.options.length > 10}
        />
      );
    }

    return (
      <div className="obb-parameter flex items-center h-[20px]">
        <DebouncedInput
          key={`input-${param.paramName}`}
          type={param.type === "number" ? "number" : "text"}
          className="obb-minimal-input bg-transparent dark:bg-transparent px-0 h-[18.8px]! border-none!"
          placeholder={param.label ?? param.paramName}
          value={value}
          debounce={1250}
          onChange={onChange}
          sizeToContent
          toolTipProps={{
            message: toolTipMessage,
            position: "top",
            delayDuration: 300,
          }}
        />
      </div>
    );
  },
);
