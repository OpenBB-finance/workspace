import { generateCustomFunctionsMetadata as generateMetadata } from "custom-functions-metadata";
import path from "path";
import { Plugin } from "vite";

interface Options {
  input: string[];
}

export default function plugin(options: Options): Plugin {
  const input = options.input.map((file) => path.resolve(file));

  return {
    name: "office-addin:custom-functions-meta",
    async buildStart() {
      const { metadataJson } = await generateMetadata(input, true);
      this.emitFile({
        type: "asset",
        fileName: "assets/functions.json",
        source: metadataJson,
      });
    },
    async configureServer(server) {
      const { metadataJson } = await generateMetadata(input, true);
      server.middlewares.use("/assets/functions.json", (req, res, next) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(metadataJson);
      });
    },
  };
}
