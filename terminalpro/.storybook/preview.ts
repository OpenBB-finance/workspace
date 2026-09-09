import type { Preview } from "storybook";
import "../src/index.css";
import { DocPage } from "./DocPage";
import { DualThemeDecorator } from "./DualThemeDecorator";

const preview: Preview = {
  decorators: [DualThemeDecorator],
  parameters: {
    layout: "fullscreen",
    docs: {
      page: DocPage,
    },
  },
};

export default preview;
