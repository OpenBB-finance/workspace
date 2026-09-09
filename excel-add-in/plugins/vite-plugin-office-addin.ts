/*
  Reference: https://github.com/jozefizso/vite-plugin-office-addin/blob/main/src/index.ts
*/

import fs from "fs";
import path from "path";
import type { Plugin, ResolvedConfig } from "vite";
import { loadEnv } from "vite";

export interface Options {
  replace: Array<{ from: RegExp | string; to: string }>;
}

export default function officeManifest(options?: Options): Plugin {
  const manifestFile = "manifest.xml";

  let viteConfig: ResolvedConfig;
  let env: Record<string, string>;

  return {
    name: "office-addin:manifest",

    configResolved(resolvedConfig: ResolvedConfig) {
      viteConfig = resolvedConfig;
      env = loadEnv(viteConfig.mode, process.cwd(), "ADDIN");
    },

    generateBundle() {
      const manifestPath = path.resolve(viteConfig.root, "manifest.xml");

      if (!fs.existsSync(manifestPath)) {
        viteConfig.logger.warn("The manifest.xml file does not exists.");
        return;
      }

      let content = fs.readFileSync(manifestPath, "utf-8");

      for (const key in env) {
        let value = env[key];
        // Replace process.env variables, helpful for CI/CD
        if (value.includes("$")) {
          for (const penv in process.env) {
            value = value.replaceAll(`$${penv}`, process.env[penv] ?? "");
          }
        }
        content = content.replaceAll(key, value);
      }

      for (const { from, to } of options?.replace ?? []) {
        content = content.replaceAll(from, to);
      }

      this.emitFile({
        type: "asset",
        fileName: manifestFile,
        source: content,
      });
    },
  };
}
