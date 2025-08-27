import path from "path";
import fs from "fs";
import { build as esBuild } from "esbuild";
import webExt from "web-ext";
import { cp } from "node:fs/promises";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const PUBLIC = path.join(ROOT, "public");
const BUILD = path.join(ROOT, "dist");

const CONFIG = {
  filesToBuild: ["background.ts", "content.ts", "popup.ts"],
  webExt: {
    artifactsDir: BUILD,
    overwriteDest: true,
    filename: "dark-mode.xpi",
    sourceDir: BUILD,
  },
};

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function copyPublicContents() {
  if (!fs.existsSync(PUBLIC)) return;

  const entries = fs.readdirSync(PUBLIC);
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(PUBLIC, entry);
      const destPath = path.join(BUILD, entry);
      await cp(srcPath, destPath, { recursive: true, force: true });
    }),
  );

  console.log(`✅ Copied contents of public folder to build`);
}

async function buildScripts() {
  for (const file of CONFIG.filesToBuild) {
    await esBuild({
      entryPoints: [path.join(SRC, file)],
      bundle: true,
      minify: true,
      sourcemap: true,
      outfile: path.join(BUILD, file.replace(/\.ts$/, ".js")),
      platform: "browser",
      format: "esm",
      target: ["es2020"],
    });
    console.log(`✅ Built ${file}`);
  }
}

async function buildExtension() {
  await webExt.cmd.build(CONFIG.webExt, { shouldExitProgram: false });
  console.log(`✅ Extension packaged to ${CONFIG.webExt.filename}`);
}

async function runBuild() {
  await ensureDir(BUILD);
  await copyPublicContents();
  await buildScripts();
  await buildExtension();
  console.log("🎉 Build complete!");
}

runBuild().catch((err) => {
  console.error("💥 Build failed:", err);
  process.exit(1);
});
