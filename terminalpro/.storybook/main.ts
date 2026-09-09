import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: [
    "../src/components/ds/**/*.stories.@(ts|tsx)",
    "../src/components/ds/**/*.mdx",
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-themes",
  ],
  staticDirs: ["../public"],
  viteFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "~": resolve(__dirname, "../src"),
    };
    return config;
  },
};

export default config;
