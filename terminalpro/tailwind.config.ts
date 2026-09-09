import tailwindTypography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";
import radixPlugin from "tailwindcss-radix";
import { colors } from "./src/components/ds/colors";
import { strokeWidthPlugin } from "./src/components/ds/plugins/stroke";
import { typographyPlugin } from "./src/components/ds/plugins/typography";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        'wl': ['var(--font-family)', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ...colors,
        main: {
          50: "var(--color-main-50)",
          100: "var(--color-main-100)",
          200: "var(--color-main-200)",
        },

        // Backward compat — remove after full migration
        brand: {
          main: "var(--brand-main)",
          lighter: "var(--brand-lighter)",
          darker: "var(--brand-darker)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        tertiary: {
          DEFAULT: "var(--tertiary)",
          foreground: "var(--tertiary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },

        // Layer 2: Semantic tokens
        general: {
          border: {
            primary: { DEFAULT: "var(--general-border-primary)" },
            secondary: { DEFAULT: "var(--general-border-secondary)" },
            disabled: "var(--general-border-disabled)",
          },
          bg: {
            primary: {
              DEFAULT: "var(--general-bg-primary)",
              hover: "var(--general-bg-primary-hover)",
              disabled: "var(--general-bg-primary-disabled)",
            },
            secondary: {
              DEFAULT: "var(--general-bg-secondary)",
              hover: "var(--general-bg-secondary-hover)",
              disabled: "var(--general-bg-secondary-disabled)",
            },
          },
          label: {
            DEFAULT: "var(--general-label)",
            hover: "var(--general-label-hover)",
            disabled: "var(--general-label-disabled)",
          },
        },
        alert: {
          success: "var(--alert-success)",
          warning: "var(--alert-warning)",
          error: "var(--alert-error)",
          informative: "var(--alert-informative)",
        },
        surface: {
          page: "var(--surface-page)",
          header: "var(--surface-header)",
          divider: "var(--surface-divider)",
          layer: "var(--surface-layer)",
          card: "var(--surface-card)",
        },
        btn: {
          primary: {
            bg: {
              DEFAULT: "var(--btn-primary-bg)",
              hover: "var(--btn-primary-bg-hover)",
              disabled: "var(--btn-primary-bg-disabled)",
            },
            label: {
              DEFAULT: "var(--btn-primary-label)",
              disabled: "var(--btn-primary-label-disabled)",
            },
          },
          secondary: {
            bg: {
              DEFAULT: "var(--btn-secondary-bg)",
              hover: "var(--btn-secondary-bg-hover)",
              disabled: "var(--btn-secondary-bg-disabled)",
            },
            border: "var(--btn-secondary-border)",
          },
          outlined: {
            border: {
              DEFAULT: "var(--btn-outlined-border)",
              hover: "var(--btn-outlined-border-hover)",
              disabled: "var(--btn-outlined-border-disabled)",
            },
            bg: {
              disabled: "var(--btn-outlined-bg-disabled)",
            },
            label: {
              DEFAULT: "var(--btn-outlined-label)",
              disabled: "var(--btn-outlined-label-disabled)",
            },
          },
          ghost: {
            bg: {
              hover: "var(--btn-ghost-bg-hover)",
            },
            label: {
              DEFAULT: "var(--btn-ghost-label)",
              disabled: "var(--btn-ghost-label-disabled)",
            },
          },
          destructive: {
            bg: {
              DEFAULT: "var(--btn-destructive-bg)",
              hover: "var(--btn-destructive-bg-hover)",
              disabled: "var(--btn-destructive-bg-disabled)",
            },
            label: {
              DEFAULT: "var(--btn-destructive-label)",
              disabled: "var(--btn-destructive-label-disabled)",
            },
          },
          warning: {
            bg: {
              DEFAULT: "var(--btn-warning-bg)",
              hover: "var(--btn-warning-bg-hover)",
              disabled: "var(--btn-warning-bg-disabled)",
            },
            label: {
              DEFAULT: "var(--btn-warning-label)",
              disabled: "var(--btn-warning-label-disabled)",
            },
          },
        },
        link: {
          color: "var(--link-color)",
        },
        dropdown: {
          border: "var(--dropdown-border)",
          bg: "var(--dropdown-bg)",
        },
        "input-field": {
          bg: {
            DEFAULT: "var(--input-bg)",
            hover: "var(--input-bg-hover)",
            disabled: "var(--input-bg-disabled)",
          },
        },
        scrollbar: {
          track: "var(--scrollbar-track)",
          handle: "var(--scrollbar-handle)",
          "handle-hover": "var(--scrollbar-handle-hover)",
        },
        tab: {
          bg: {
            primary: "var(--tab-bg-primary)",
            secondary: "var(--tab-bg-secondary)",
          },
          "group-bg": "var(--tab-group-bg)",
          border: "var(--tab-border)",
          "action-active": "var(--tab-action-active)",
          "filled-primary": {
            bg: {
              active: "var(--tab-filled-primary-bg-active)",
            },
            text: {
              active: "var(--tab-filled-primary-text-active)",
            },
          },
          "filled-secondary": {
            text: {
              DEFAULT: "var(--tab-filled-secondary-text)",
              active: "var(--tab-filled-secondary-text-active)",
            },
            bg: {
              active: "var(--tab-filled-secondary-bg-active)",
              hover: "var(--tab-filled-secondary-bg-hover)",
            },
          },
        },
        tag: {
          pink: { bg: "var(--tag-pink-bg)", label: "var(--tag-pink-label)" },
          blue: { bg: "var(--tag-blue-bg)", label: "var(--tag-blue-label)" },
          green: { bg: "var(--tag-green-bg)", label: "var(--tag-green-label)" },
          red: { bg: "var(--tag-red-bg)", label: "var(--tag-red-label)" },
          yellow: { bg: "var(--tag-yellow-bg)", label: "var(--tag-yellow-label)" },
          orange: { bg: "var(--tag-orange-bg)", label: "var(--tag-orange-label)" },
          coral: { bg: "var(--tag-coral-bg)", label: "var(--tag-coral-label)" },
          burgundy: { bg: "var(--tag-burgundy-bg)", label: "var(--tag-burgundy-label)" },
          grey: { bg: "var(--tag-grey-bg)", label: "var(--tag-grey-label)" },
          turquoise: { bg: "var(--tag-turquoise-bg)", label: "var(--tag-turquoise-label)" },
          purple: { bg: "var(--tag-purple-bg)", label: "var(--tag-purple-label)" },
          brand: { bg: "var(--tag-brand-bg)", label: "var(--tag-brand-label)" },
        },
        table: {
          "header-bg": "var(--table-header-bg)",
          "cell-bg": {
            DEFAULT: "var(--table-cell-bg)",
            hover: "var(--table-cell-bg-hover)",
          },
        },
        tooltip: {
          bg: "var(--tooltip-bg)",
        },
        toggle: {
          bg: {
            DEFAULT: "var(--toggle-bg)",
            disabled: "var(--toggle-bg-disabled)",
          },
        },
        search: {
          "widget-bg": "var(--search-widget-background)",
        },
        "ds-text": {
          heading: "var(--text-heading)",
          subtitle: "var(--text-subtitle)",
          body: "var(--text-body)",
          caption: "var(--text-caption)",
          support: "var(--text-support)",
        },
        copilot: {
          "mention-bg": "var(--copilot-mention-bg)",
          "mention-label": "var(--copilot-mention-label)",
          "mention-web-bg": "var(--copilot-mention-web-bg)",
          "mention-web-label": "var(--copilot-mention-web-label)",
        },
        components: {
          chat: {
            "copilot-cards-bg": "var(--components-chat-copilot-cards-bg)",
          },
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "light-1": "0px 2px 10px 0px rgba(0, 0, 0, 0.10)",
        "light-2": "2px 4px 15px 0px rgba(0, 0, 0, 0.10)",
        "light-3": "0px 2px 10px 0px rgba(0, 0, 0, 0.20)",
        "dark-1": "0px 2px 10px 0px rgba(0, 0, 0, 0.40)",
        "dark-2": "2px 4px 15px 0px rgba(0, 0, 0, 0.60)",
        "dark-3": "0px 2px 10px 0px rgba(0, 0, 0, 0.80)",
        dropdown: "var(--dropdown-shadow)",
      },
      strokeWidth: {
        0.5: "0.5px",
        1: "1px",
        1.5: "1.5px",
        2: "2px",
        2.5: "2.5px",
        3: "3px",
        4: "4px",
        5: "5px",
      },
      screens: {
        "only-sm": { max: "639px" },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        slideUpAndFade: {
          "0%": { opacity: "0", transform: "translateY(2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideRightAndFade: {
          "0%": { opacity: "0", transform: "translateX(-2px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideDownAndFade: {
          "0%": { opacity: "0", transform: "translateY(-2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideLeftAndFade: {
          "0%": { opacity: "0", transform: "translateX(2px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Tooltip
        "slide-up-fade": {
          "0%": { opacity: "0", transform: "translateY(2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-right-fade": {
          "0%": { opacity: "0", transform: "translateX(-2px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-down-fade": {
          "0%": { opacity: "0", transform: "translateY(-2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-left-fade": {
          "0%": { opacity: "0", transform: "translateX(2px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        // Navigation menu
        "enter-from-right": {
          "0%": { transform: "translateX(200px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "enter-from-left": {
          "0%": { transform: "translateX(-200px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "exit-to-right": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(200px)", opacity: "0" },
        },
        "exit-to-left": {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(-200px)", opacity: "0" },
        },
        "scale-in-content": {
          "0%": { transform: "rotateX(-30deg) scale(0.9)", opacity: "0" },
          "100%": { transform: "rotateX(0deg) scale(1)", opacity: "1" },
        },
        "scale-out-content": {
          "0%": { transform: "rotateX(0deg) scale(1)", opacity: "1" },
          "100%": { transform: "rotateX(-10deg) scale(0.95)", opacity: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        // Toast
        "toast-hide": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "toast-slide-in-right": {
          "0%": { transform: "translateX(calc(100% + 1rem))" },
          "100%": { transform: "translateX(0)" },
        },
        "toast-slide-in-bottom": {
          "0%": { transform: "translate(-50%, calc(100% + 1rem))" },
          "100%": { transform: "translateY(0)" },
        },
        "toast-swipe-out": {
          "0%": { transform: "translateX(var(--radix-toast-swipe-end-x))" },
          "100%": {
            transform: "translateX(calc(100% + 1rem))",
          },
        },
        // Accordion, Collapsible
        collapse: {
          "0%": { height: "var(--radix-collapsible-content-height)" },
          "100%": { height: "0" },
        },
        expand: {
          "0%": { height: "0" },
          "100%": { height: "var(--radix-collapsible-content-height)" },
        },
        "fade-in-down": {
          "0%": {
            opacity: "0",
            transform: "translateY(-60px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
      },
      fontSize: {
        "2xs": "calc(0.625rem * var(--text-scale, 1))",
        "xs": "calc(0.75rem * var(--text-scale, 1))",
        "sm": "calc(0.875rem * var(--text-scale, 1))",
        "base": "calc(1rem * var(--text-scale, 1))",
        "lg": "calc(1.125rem * var(--text-scale, 1))",
        "xl": "calc(1.25rem * var(--text-scale, 1))",
        "2xl": "calc(1.5rem * var(--text-scale, 1))",
        "3xl": "calc(1.875rem * var(--text-scale, 1))",
        "4xl": "calc(2.25rem * var(--text-scale, 1))",
        "5xl": "calc(3rem * var(--text-scale, 1))",
        "6xl": "calc(3.75rem * var(--text-scale, 1))",
        "7xl": "calc(4.5rem * var(--text-scale, 1))",
        "8xl": "calc(6rem * var(--text-scale, 1))",
        "9xl": "calc(8rem * var(--text-scale, 1))",
      },
      zIndex: {
        "60": "60",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        slideUpAndFade: "slideUpAndFade 300ms cubic-bezier(0.16, 0, 0.13, 1)",
        slideDownAndFade: "slideDownAndFade 300ms cubic-bezier(0.16, 0, 0.13, 1)",
        slideRightAndFade: "slideRightAndFade 300ms cubic-bezier(0.16, 0, 0.13, 1)",
        slideLeftAndFade: "slideLeftAndFade 300ms cubic-bezier(0.16, 0, 0.13, 1)",
        // Dropdown menu
        "scale-in": "scale-in 0.2s ease-in-out",
        "slide-down": "slide-down 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        // Tooltip
        "slide-up-fade": "slide-up-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-right-fade": "slide-right-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-down-fade": "slide-down-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-left-fade": "slide-left-fade 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        // Navigation menu
        "enter-from-right": "enter-from-right 0.25s ease",
        "enter-from-left": "enter-from-left 0.25s ease",
        "exit-to-right": "exit-to-right 0.25s ease",
        "exit-to-left": "exit-to-left 0.25s ease",
        "scale-in-content": "scale-in-content 0.2s ease",
        "scale-out-content": "scale-out-content 0.2s ease",
        "fade-in": "fade-in 0.2s ease",
        "fade-out": "fade-out 0.2s ease",
        // Toast
        "toast-hide": "toast-hide 100ms ease-in forwards",
        "toast-slide-in-right":
          "toast-slide-in-right 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        "toast-slide-in-bottom":
          "toast-slide-in-bottom 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        "toast-swipe-out": "toast-swipe-out 100ms ease-out forwards",
        // Accordion, Collapsible
        collapse: "collapse 200ms ease-in-out",
        expand: "expand 75ms ease-in-out",
        // Lanyard, fade and fall in
        "fade-in-down": "fade-in-down 2s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [
    radixPlugin,
    tailwindTypography,
    strokeWidthPlugin,
    animatePlugin,
    typographyPlugin,
  ],
} satisfies Config;
