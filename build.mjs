import * as esbuild from "esbuild";
import { cp, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const pkg = JSON.parse(await readFile("package.json", "utf-8"));

await mkdir("dist", { recursive: true });

const result = await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "dist/bundle.cjs",
  sourcemap: true,
  minify: true,
  banner: {
    js: `// DL-MCP v${pkg.version} - Enterprise Filesystem MCP Server`,
  },
});

if (result.errors.length > 0) {
  console.error("Build failed:", result.errors);
  process.exit(1);
}

if (existsSync("dist/.env")) {
  await cp("dist/.env", "dist/bundle.env");
} else if (existsSync(".env")) {
  await cp(".env", "dist/bundle.env");
}

const stats = await readFile("dist/bundle.cjs", "utf-8");
const kb = (stats.length / 1024).toFixed(0);
console.log(`\u2713 Bundle: dist/bundle.cjs (${kb}KB)`);
console.log(`  Config: dist/bundle.env`);

console.log("\n---");
console.log("  Run:     node dist/bundle.cjs");
console.log("  Linux:   npm run pkg:linux");
console.log("  macOS:   npm run pkg:mac");
console.log("  Windows: npm run pkg:win");
console.log("  All:     npm run pkg:all");
