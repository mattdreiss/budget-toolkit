import { context, build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "dist");
const watch = process.argv.includes("--watch");

/**
 * Two independent bundles, because the two content scripts run in different
 * JS worlds (see manifest.json) and share no module state. `iife` keeps each
 * one a single self-contained file, which is what MV3 content scripts want —
 * ESM content scripts are not directly supported.
 */
const options = {
  entryPoints: {
    "main-world": join(root, "src/entries/mainWorld.ts"),
    content: join(root, "src/entries/contentScript.ts"),
  },
  outdir,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
  logLevel: "info",
};

const copyStyles = () =>
  cp(join(root, "src/presentation/styles.css"), join(outdir, "styles.css"));

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await copyStyles();

if (watch) {
  const ctx = await context({
    ...options,
    plugins: [
      {
        name: "copy-styles",
        setup: (b) => b.onEnd(copyStyles),
      },
    ],
  });
  await ctx.watch();
  console.log("watching…");
} else {
  await build(options);
}
