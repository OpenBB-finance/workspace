import { describe, expect, it, vi } from "vitest";
import { strokeWidthPlugin } from "~/components/ds/plugins/stroke";
import {
  typographyClassGroup,
  typographyPlugin,
} from "~/components/ds/plugins/typography";

describe("DS Plugins", () => {
  describe("strokeWidthPlugin", () => {
    it("matches stroke utilities", () => {
      const matchUtilities = vi.fn();
      const theme = vi.fn();
      // @ts-ignore
      strokeWidthPlugin.handler({ matchUtilities, theme });
      expect(matchUtilities).toHaveBeenCalled();
    });
  });

  describe("typographyPlugin", () => {
    it("adds typography utilities", () => {
      const addUtilities = vi.fn();
      // @ts-ignore
      typographyPlugin.handler({ addUtilities });
      expect(addUtilities).toHaveBeenCalled();

      const firstClass = `.${typographyClassGroup[0]}`;
      expect(addUtilities).toHaveBeenCalledWith(
        expect.objectContaining({
          [firstClass]: expect.any(Object),
        }),
      );
    });

    it("has expected class groups", () => {
      expect(typographyClassGroup).toContain("title-xs-bold");
      expect(typographyClassGroup).toContain("body-md-regular");
    });
  });
});
