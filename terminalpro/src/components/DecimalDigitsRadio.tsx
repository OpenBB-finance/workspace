import clsx from "clsx";
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupLabel,
} from "~/components/ds/atoms/RadioGroup";
import Tooltip from "~/components/Tooltip";

const options = ["1", "1.2", "1.23", "1.234", "1.2345", "1.23456"];

export default function DecimalDigitsRadio({
  label = "Decimal limit digits",
  decimalDigits,
  setDecimalDigits,
  extraClassName,
}: {
  label?: string;
  decimalDigits: number;
  setDecimalDigits: (value: number) => void;
  extraClassName?: string;
}) {
  return (
    <div>
      <Tooltip
        message="Per-column decimalPlaces in widgets.json will override this setting."
        position="top"
      >
        <RadioGroupLabel className="body-xs-bold text-light-900 dark:text-light-50">
          {label}
        </RadioGroupLabel>
      </Tooltip>
      <RadioGroup
        value={decimalDigits.toString()}
        onValueChange={(value: string) => setDecimalDigits(Number.parseInt(value, 10))}
        className={clsx(
          "flex items-end flex-wrap gap-4 justify-between",
          extraClassName,
        )}
      >
        {options.map((label, i) => (
          <div className="flex items-center gap-3" key={i}>
            <RadioGroupItem
              data-testid={`decimal-digits-${i}`}
              value={i.toString()}
              label={label}
            />
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
