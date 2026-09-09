import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import eslint from "vite-plugin-eslint";
import { Mode, plugin as mdPlugin } from "vite-plugin-markdown";

import packageJson from "./package.json";
import cfmPlugin from "./plugins/vite-custom-functions-meta";
import officeAddin from "./plugins/vite-plugin-office-addin";
import moveAssetPlugin from "./plugins/vite-move-asset";

async function getHttpsOptions() {
  const devCerts = await import("office-addin-dev-certs");
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return {
    ca: httpsOptions.ca,
    key: httpsOptions.key,
    cert: httpsOptions.cert,
  };
}

// https://vitejs.dev/config/
export default defineConfig(async ({ mode, command }) => {
  console.info("command:", command, mode);
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };

  const { ADDIN_BASE_URL } = process.env;

  let ADDIN_NAME_SUFFIX: string = "";
  let ADDIN_FUNCS_SUFFIX: string = "";
  if (ADDIN_BASE_URL?.includes("localhost")) {
      ADDIN_NAME_SUFFIX = "(Local)";
      ADDIN_FUNCS_SUFFIX = ".LOCAL";
  } else if (ADDIN_BASE_URL?.includes(".dev")) {
      ADDIN_NAME_SUFFIX = "(Dev)";
      ADDIN_FUNCS_SUFFIX = ".DEV";
  }
  const https = command === "serve" ? await getHttpsOptions() : false;

  return {
    resolve: {
      alias: {
        "~": path.resolve(__dirname, "./src"),
        "~public": path.resolve(__dirname, "./public"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          taskpane: path.resolve(__dirname, "index.html"),
          commands: path.resolve(__dirname, "commands.html"),
        },
      },
      outDir: "./dist",
      emptyOutDir: true,
    },
    server: {
      https,
    },
    plugins: [
      react(),
      eslint(),
      officeAddin({
        replace: [
          { from: "1.0.0.0", to: `1.${packageJson.version}` },
          ...(ADDIN_NAME_SUFFIX
            ? [
                {
                  from: `id="CustomTab.Label" DefaultValue="OpenBB"`,
                  to: `id="CustomTab.Label" DefaultValue="OpenBB ${ADDIN_NAME_SUFFIX}"`,
                },
                {
                  from: '<DisplayName DefaultValue="OpenBB Add-in for Excel',
                  to: `<DisplayName DefaultValue="OpenBB Add-in for Excel ${ADDIN_NAME_SUFFIX}`,
                },
                {
                  from: '<bt:String id="Functions.Namespace" DefaultValue="OBB" />',
                  to: `<bt:String id="Functions.Namespace" DefaultValue="OBB${ADDIN_FUNCS_SUFFIX}" />`,
                }
              ]
            : []),
        ],
      }),
      cfmPlugin({
        input: ["./src/functions/functions.ts"],
      }),
      mdPlugin({ mode: [Mode.REACT] }),
    ],
  };
});
