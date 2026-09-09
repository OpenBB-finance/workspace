import fs from "fs";
import path from "path";
import type { Plugin, ResolvedConfig } from "vite";

export interface MoveAssetOptions {
  source: string;
  destination: string;
}

export default function moveAssetPlugin(options: MoveAssetOptions): Plugin {
  let viteConfig: ResolvedConfig;

  return {
    name: "move-file-plugin",

    configResolved(resolvedConfig: ResolvedConfig) {
      viteConfig = resolvedConfig;
    },

    buildEnd() {
      const sourcePath = path.resolve(viteConfig.root, options.source);
      const destinationPath = path.resolve(viteConfig.root, options.destination);

      if (!fs.existsSync(sourcePath)) {
        viteConfig.logger.warn(`The source file ${options.source} does not exist.`);
        return;
      }

      // Create the destination directory if it doesn't exist
      const destinationDir = path.dirname(destinationPath);
      if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
      }

      // Move the file
      fs.copyFileSync(sourcePath, destinationPath);
      viteConfig.logger.info(`File ${options.source} moved to ${options.destination}.`);
    },
  };
}