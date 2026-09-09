import type { Config } from "tailwindcss";
import conf from "@openbb/ui/tailwind.config";

export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx,mdx}",
    "./node_modules/@openbb/ui/dist/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [conf],
  theme: {
    extend: {
      fontFamily: {
        wl: ["var(--font-family)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        surface: {
          page: "var(--surface-page)",
          card: "var(--surface-card)",
          header: "var(--surface-header)",
          divider: "var(--surface-divider)",
        },
        general: {
          bg: {
            primary: "var(--general-bg-primary)",
            "primary-hover": "var(--general-bg-primary-hover)",
            secondary: "var(--general-bg-secondary)",
            "secondary-hover": "var(--general-bg-secondary-hover)",
          },
          border: {
            primary: "var(--general-border-primary)",
          },
          label: {
            DEFAULT: "var(--general-label)",
            hover: "var(--general-label-hover)",
            disabled: "var(--general-label-disabled)",
          },
        },
        btn: {
          primary: {
            bg: "var(--btn-primary-bg)",
            "bg-hover": "var(--btn-primary-bg-hover)",
            label: "var(--btn-primary-label)",
          },
          secondary: {
            bg: "var(--btn-secondary-bg)",
            "bg-hover": "var(--btn-secondary-bg-hover)",
          },
        },
        link: {
          color: "var(--link-color)",
        },
        "ds-text": {
          heading: "var(--text-heading)",
          subtitle: "var(--text-subtitle)",
          body: "var(--text-body)",
        },
      },
    },
  },
} satisfies Config;
