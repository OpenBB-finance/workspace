/* Utility values */

export const current = "currentColor" as const;
export const inherit = "inherit" as const;
export const transparent = "transparent" as const;

/* Primitives */

export const base = {
  0: "#FFFFFF",
  100: "#0C0C0E",
} as const;

export const main = {
  50: "#33BBFF",
  100: "#0077B3",
  200: "#006699",
} as const;

export const dark = {
  50: "#8A8A90",
  100: "#6D6E74",
  200: "#5A5961",
  300: "#505059",
  400: "#46464F",
  500: "#36363F",
  600: "#303038",
  700: "#2A2A31",
  750: "#24242A",
  800: "#212127",
  850: "#1C1B20",
  900: "#151518",
} as const;

export const light = {
  50: "#F7F8F9",
  100: "#F3F4F7",
  200: "#EBECF0",
  300: "#D6DCE5",
  400: "#D0D5DD",
  500: "#9DA5B2",
  600: "#667085",
  700: "#485468",
  750: "#3D4758",
  800: "#354055",
  850: "#1E2939",
  900: "#0F1828",
} as const;

export const error = {
  50: "#FFC5C5",
  100: "#E03C3C",
  200: "#B91C1C",
} as const;

export const success = {
  50: "#CCF7DC",
  100: "#2DAC5C",
  200: "#15803D",
} as const;

export const warning = {
  50: "#FFD4A4",
  100: "#F18A1A",
  200: "#BA6509",
} as const;

export const informative = {
  50: "#C8E7FF",
  100: "#3892D9",
  200: "#065592",
} as const;

export const extra = {
  grey: { 50: "#D9DEE7", 100: "#5C6370", 200: "#4C525D" },
  pink: { 50: "#FFDDF0", 100: "#F467B4", 200: "#612346" },
  turquoise: { 50: "#D5F9FF", 100: "#3C9CAC", 200: "#15373D" },
  burgundy: { 50: "#F1D7E9", 100: "#C965A9", 200: "#5E1146" },
  coral: { 50: "#FFD6C8", 100: "#F26050", 200: "#5E2711" },
  yellow: { 50: "#F5EEA0", 100: "#D2AB21", 200: "#413B1C" },
  orange: { 50: "#FFE2A3", 100: "#D58227", 200: "#52340E" },
  red: { 50: "#FFCACA", 100: "#D53939", 200: "#4E1717" },
  purple: { 50: "#E7DFFF", 100: "#967BED", 200: "#3F285B" },
  green: { 50: "#D2F8D4", 100: "#57BA6F", 200: "#254725" },
  blue: { 50: "#C0EAFF", 100: "#247199", 200: "#126B99" },
} as const;

export const colors = {
  current,
  inherit,
  transparent,

  base,
  main,
  dark,
  light,

  error,
  success,
  warning,
  informative,

  extra,
} as const;
