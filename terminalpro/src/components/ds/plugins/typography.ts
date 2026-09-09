// @ts-expect-error - ignored for now
import plugin from "tailwindcss/plugin";

const STYLE = {
  title: {
    fontFamily: "Inter",
  },
  subtitle: {
    fontFamily: "Inter",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  body: { fontFamily: "Inter" },
} as const;

const SIZE = {
  title: {
    xs: {
      fontSize: "calc(1.5rem * var(--text-scale, 1))",
      lineHeight: "calc(2.25rem * var(--text-scale, 1))",
    },
    sm: {
      fontSize: "calc(1.75rem * var(--text-scale, 1))",
      lineHeight: "calc(2.625rem * var(--text-scale, 1))",
    },
    md: {
      fontSize: "calc(2rem * var(--text-scale, 1))",
      lineHeight: "calc(3rem * var(--text-scale, 1))",
    },
    lg: {
      fontSize: "calc(2.5rem * var(--text-scale, 1))",
      lineHeight: "calc(3.75rem * var(--text-scale, 1))",
    },
    xl: {
      fontSize: "calc(3rem * var(--text-scale, 1))",
      lineHeight: "calc(4rem * var(--text-scale, 1))",
    },
  },
  subtitle: {
    "2xs": {
      fontSize: "calc(0.625rem * var(--text-scale, 1))",
      lineHeight: "calc(1rem * var(--text-scale, 1))",
    },
    xs: {
      fontSize: "calc(0.75rem * var(--text-scale, 1))",
      lineHeight: "calc(1.125rem * var(--text-scale, 1))",
    },
    sm: {
      fontSize: "calc(0.875rem * var(--text-scale, 1))",
      lineHeight: "calc(1.375rem * var(--text-scale, 1))",
    },
    md: {
      fontSize: "calc(1.125rem * var(--text-scale, 1))",
      lineHeight: "calc(1.75rem * var(--text-scale, 1))",
    },
    lg: {
      fontSize: "calc(1.25rem * var(--text-scale, 1))",
      lineHeight: "calc(2rem * var(--text-scale, 1))",
    },
    xl: {
      fontSize: "calc(1.5rem * var(--text-scale, 1))",
      lineHeight: "calc(2rem * var(--text-scale, 1))",
    },
  },
  body: {
    xs: {
      fontSize: "calc(0.75rem * var(--text-scale, 1))",
      lineHeight: "calc(1.125rem * var(--text-scale, 1))",
    },
    sm: {
      fontSize: "calc(0.875rem * var(--text-scale, 1))",
      lineHeight: "calc(1.375rem * var(--text-scale, 1))",
    },
    md: {
      fontSize: "calc(1rem * var(--text-scale, 1))",
      lineHeight: "calc(1.5rem * var(--text-scale, 1))",
    },
    lg: {
      fontSize: "calc(1.125rem * var(--text-scale, 1))",
      lineHeight: "calc(1.75rem * var(--text-scale, 1))",
    },
    xl: {
      fontSize: "calc(1.25rem * var(--text-scale, 1))",
      lineHeight: "calc(1.875rem * var(--text-scale, 1))",
    },
    subtitle: {
      fontSize: "calc(2rem * var(--text-scale, 1))",
      lineHeight: "calc(3rem * var(--text-scale, 1))",
    },
  },
} as const;

const WEIGHT = {
  bold: { fontWeight: "700" },
  medium: { fontWeight: "500" },
  regular: { fontWeight: "400" },
} as const;

type Style = keyof typeof STYLE;
type Size<T extends Style> = keyof (typeof SIZE)[T];
type Weight = keyof typeof WEIGHT;
// type TypographyClass = `${Style}-${Size<Style>}-${Weight}`; //? not sure I need it
type TypographyObject = Record<string, string>;

const classMap = new Map<string, TypographyObject>();
for (const _style in STYLE) {
  const style = _style as Style;
  for (const _size in SIZE[style]) {
    const size = _size as Size<typeof style>;
    for (const _weight in WEIGHT) {
      const weight = _weight as Weight;
      classMap.set(`${style}-${size}-${weight}`, {
        ...STYLE[style],
        ...SIZE[style][size],
        ...WEIGHT[weight],
      });
    }
  }
}
export const typographyClassGroup = [...classMap.keys()];

export const typographyPlugin = plugin(({ addUtilities }) => {
  classMap.forEach((value, key) => {
    addUtilities({
      [`.${key}`]: value,
    });
  });
});
