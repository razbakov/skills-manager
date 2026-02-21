import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(projectRoot, "dist", "electron");

mkdirSync(outputDir, { recursive: true });

await build({
  entryPoints: [resolve(projectRoot, "src", "electron", "main.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external: ["electron"],
  outfile: resolve(outputDir, "main.js"),
  banner: {
    js: "import { createRequire } from 'node:module';const require = createRequire(import.meta.url);",
  },
});

cpSync(
  resolve(projectRoot, "src", "electron", "preload.cjs"),
  resolve(outputDir, "preload.cjs"),
);
