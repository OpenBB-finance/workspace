import { viteStaticCopy } from "vite-plugin-static-copy";
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths'
import react from '@vitejs/plugin-react';
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    viteStaticCopy({
      targets: [
        {
          src: "./node_modules/@openbb/ui/dist/assets",
          dest: "",
        },
      ],
    }),
  ],
  server: {
  watch: {
    usePolling: true,
  },
  host: true,
  strictPort: true,
  port: 5173,
  allowedHosts: [
    "admin.openbb.co",
    "admin.openbb.dev",
  ],
}});
