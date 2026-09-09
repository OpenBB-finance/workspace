import { defineConfig } from "@openapi-codegen/cli";
import {
  generateReactQueryComponents,
  generateSchemaTypes,
} from "@openapi-codegen/typescript";

export default defineConfig({
  sdk: {
    from: {
      source: "url",
      url: "http://localhost:6586/openapi.json",
    },
    outputDir: "src/lib/api2",
    to: async (context) => {
      const filenamePrefix = "sdk";
      const { schemasFiles } = await generateSchemaTypes(context, {
        filenamePrefix,
      });
      await generateReactQueryComponents(context, {
        filenamePrefix,
        schemasFiles,
      });
    },
  },
});
