import React from "react";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  type SelectTriggerProps,
  SelectValue,
} from "~/components/ds/atoms/Select";
import { cn } from "~/components/ds/utils";

interface FontFamilyInputProps extends Omit<SelectTriggerProps, "onChange"> {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

interface FontOption {
  label: string;
  value: string;
  fontFamily: string;
}

const fontFamilies: FontOption[] = [
  { label: "Unchanged", value: "unchanged", fontFamily: "inherit" },
  {
    label: "System",
    value: "System",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  },
  { label: "Arial", value: "Arial", fontFamily: "Arial, sans-serif" },
  { label: "Inter", value: "Inter", fontFamily: "Inter, sans-serif" },
  {
    label: "IBM Plex Sans",
    value: "IBM Plex Sans",
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  {
    label: "IBM Plex Mono",
    value: "IBM Plex Mono",
    fontFamily: "'IBM Plex Mono', monospace",
  },
  { label: "Roboto", value: "Roboto", fontFamily: "Roboto, sans-serif" },
  {
    label: "Inclusive Sans",
    value: "Inclusive Sans",
    fontFamily: "'Inclusive Sans', sans-serif",
  },
  { label: "Open Sans", value: "Open Sans", fontFamily: "'Open Sans', sans-serif" },
  { label: "Lato", value: "Lato", fontFamily: "Lato, sans-serif" },
  {
    label: "Times New Roman",
    value: "Times New Roman",
    fontFamily: "'Times New Roman', serif",
  },
  { label: "Merriweather", value: "Merriweather", fontFamily: "Merriweather, serif" },
  {
    label: "UnifrakturCook",
    value: "UnifrakturCook",
    fontFamily: "UnifrakturCook, fantasy",
  },
  {
    label: "Pixelify Sans",
    value: "Pixelify Sans",
    fontFamily: "'Pixelify Sans', sans-serif",
  },
];

export const FontFamilyInput = React.forwardRef<
  React.ElementRef<typeof SelectTrigger>,
  FontFamilyInputProps
>(({ value, onChange, className, placeholder, ...props }, ref) => {
  const handleChange = (val: string) => {
    onChange(val === "unchanged" ? "" : val);
  };

  const currentFont = fontFamilies.find(
    (f) => f.value === (value === "" ? "unchanged" : value),
  );

  return (
    <SelectRoot value={value === "" ? "unchanged" : value} onValueChange={handleChange}>
      <SelectTrigger ref={ref} className={cn(className)} {...props}>
        <SelectValue
          placeholder={placeholder}
          style={{
            fontFamily: currentFont?.fontFamily || "inherit",
          }}
        />
      </SelectTrigger>
      <SelectContent>
        {fontFamilies.map((font) => (
          <SelectItem
            key={font.value}
            value={font.value}
            style={{ fontFamily: font.fontFamily }}
          >
            {font.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
});

FontFamilyInput.displayName = "FontFamilyInput";
