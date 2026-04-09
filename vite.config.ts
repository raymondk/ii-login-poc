import { tanstackViteConfig } from "@tanstack/vite-config";

export default tanstackViteConfig({
  entry: ["./src/index.ts"],
  srcDir: "./src",
  outDir: "./dist",
  tsconfigPath: "./tsconfig.lib.json",
});
