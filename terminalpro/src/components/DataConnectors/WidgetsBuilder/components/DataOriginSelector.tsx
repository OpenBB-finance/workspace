import { memo } from "react";
import { RadioGroup, RadioGroupItem } from "~/components/ds/atoms/RadioGroup";
import type { FormState } from "../types";
import { useWidgetConfigContext } from "../WidgetConfigContext";

export const DataOriginSelector = memo(() => {
  const { value, dispatchFormState } = useWidgetConfigContext((s) => ({
    value: s.formState?.dataOrigin,
    dispatchFormState: s.dispatchFormState,
  }));

  return (
    <div className="px-6 mb-6 flex items-center gap-6 flex-shrink-0 whitespace-nowrap">
      <span className="body-sm-bold">Data origin:</span>
      <RadioGroup
        value={value}
        onValueChange={(dataOrigin: FormState["dataOrigin"]) =>
          dispatchFormState({ dataOrigin })
        }
        className="flex gap-6"
      >
        <RadioGroupItem value="new_endpoint" label="New Endpoint" />
        <RadioGroupItem value="existing_widget" label="From existing Widget" />
      </RadioGroup>
    </div>
  );
});

DataOriginSelector.displayName = "DataOriginSelector";
