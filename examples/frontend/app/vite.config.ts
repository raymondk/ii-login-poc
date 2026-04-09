import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";
import path from "path";

// Usage: ICP_ENVIRONMENT=staging npm run dev
const environment = process.env.ICP_ENVIRONMENT || "local";

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const plugins = [
    react(),
  ];

  const resolve = {
    alias: {
      "@icp-sdk/cli-auth": path.resolve(__dirname, "../../../src/index.ts"),
    },
  };

  if (command !== "serve") {
    return { plugins, resolve };
  }

  // Dev server mode: configure ic_env cookie and proxy
  const networkStatus = JSON.parse(
    execSync(`icp network status -e ${environment} --json`, { encoding: "utf-8" })
  );
  const rootKey: string = networkStatus.root_key;
  const proxyTarget: string = networkStatus.api_url;

  const server = {
    headers: {
      // Note: ic_root_key must be lowercase - library converts to uppercase IC_ROOT_KEY
      "Set-Cookie": `ic_env=${encodeURIComponent(
        `ic_root_key=${rootKey}`
      )}; SameSite=Lax;`,
    },
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  };

  return {
    plugins,
    server,
    resolve,
  };

});
