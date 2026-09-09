import {
  Title,
  Subtitle,
  Description,
  Primary,
  Controls,
  Stories,
} from "@storybook/addon-docs/blocks";
import { TokenSection } from "./TokenSection";

export function DocPage() {
  return (
    <>
      <Title />
      <Subtitle />
      <Description />
      <Primary />
      <Controls />
      <TokenSection />
      <Stories />
    </>
  );
}
