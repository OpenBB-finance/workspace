import { Checkbox } from "../ds/atoms/Checkbox";

interface AgreementProps {
  id: string;
  errorMessage: string;
  value: boolean;
  onChange: (checked: boolean) => void;
}

export function Agreement({ id, onChange }: AgreementProps) {
  return (
    <div className="flex gap-3 items-start text-light-800">
      <Checkbox
        required={true}
        id={id}
        onCheckedChange={onChange}
        className="border-light-600 dark:border-light-600 hover:border-light-700! dark:hover:border-light-700! dark:data-[state=checked]:border-brand-main! data-[state=checked]:border-brand-main"
      />
      <label htmlFor={id} className="-mt-1 text-xs text-left text-light-800">
        I am over 16 years of age and I agree to the{" "}
        <a
          className="obb-hyper-link text-xs"
          target="_blank"
          rel="noopener noreferrer"
          href="https://openbb.co/legal/terms-of-service"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          className="obb-hyper-link text-xs"
          target="_blank"
          rel="noopener noreferrer"
          href="https://openbb.co/legal/privacy-policy"
        >
          Privacy Policy
        </a>
        .
      </label>
    </div>
  );
}
