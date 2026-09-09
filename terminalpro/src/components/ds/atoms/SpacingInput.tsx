import { Input, type InputProps } from "~/components/ds/atoms/Input";
import { Select, type SelectOption } from "~/components/ds/atoms/Select";
import { cn } from "../utils";

type InputValue = string | number;

interface SpacingInputProps extends InputProps {
  value?: string | number;
  onChange: (value: string) => void;
  units?: SelectOption[];
}

const defaultUnits: SelectOption[] = [
  { label: "px", value: "px" },
  { label: "rem", value: "rem" },
  { label: "em", value: "em" },
  { label: "%", value: "%" },
];

export function SpacingInput({
  value = "",
  onChange,
  units = defaultUnits,
  className,
  ...props
}: SpacingInputProps) {
  const parts = value.toString().match(/(-?\d*\.?\d+)(\D*)/) || ["", "", "px"];
  const numberValue = parts[1];
  const unitValue = parts[2] || "px";

  const handleNumberChange = (newNumber: InputValue) => {
    if (!newNumber) return onChange("");
    onChange(`${newNumber}${unitValue}`);
  };

  const handleUnitChange = (newUnit: string) => {
    onChange(`${numberValue || 1}${newUnit}`);
  };

  return (
    <div className={cn("flex items-center", className)}>
      <div className="w-full">
        <Input
          type="number"
          value={numberValue}
          onChange={handleNumberChange}
          className="rounded-r-none"
          {...props}
        />
      </div>
      <Select
        value={unitValue}
        onValueChange={handleUnitChange}
        options={units}
        className="w-auto rounded-l-none border-l-0"
      />
    </div>
  );
}
