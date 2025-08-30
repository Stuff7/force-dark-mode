import path from "path";
import fs from "fs";
import esbuild, {
  type Plugin,
  type PluginBuild,
  type BuildOptions,
} from "esbuild";
import webExt from "web-ext";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { compile } from "svelte/compiler";
import { cp } from "node:fs/promises";
import { escapeCSS } from "./src/utils.ts";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const PUBLIC = path.join(ROOT, "public");
const BUILD = path.join(ROOT, "dist");

type TailwindIO = {
  in?: string;
  out: {
    kind: "path" | "repl";
    value: string;
  };
};

const CONFIG = {
  filesToBuild: ["background.ts", "content.ts", "popup.ts"],
  webExt: {
    artifactsDir: BUILD,
    overwriteDest: true,
    filename: "dark-mode.xpi",
    sourceDir: BUILD,
  },

  tailwind: {
    io: [
      {
        out: { kind: "path", value: path.join(BUILD, "popup.css") },
      },
      {
        out: { kind: "repl", value: path.join(BUILD, "content.js") },
      },
    ] as TailwindIO[],
    contentGlobs: ["**/*.svelte", "**/*.html"].map((glob) =>
      path.join(SRC, glob),
    ),
  },

  svelte: {
    entryPoint: path.join(SRC, "main.ts"),
    outputBundle: path.join(BUILD, "bundle.js"),
    globalName: "app",
    format: "iife" as BuildOptions["format"],
    minify: false,
    sourcemap: true,
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
    await esbuild.build({
      entryPoints: [path.join(SRC, file)],
      bundle: true,
      minify: CONFIG.svelte.minify,
      sourcemap: CONFIG.svelte.sourcemap,
      outfile: path.join(BUILD, file.replace(/\.ts$/, ".js")),
      platform: "browser",
      target: ["es2020"],
      plugins: [sveltePlugin],
      format: CONFIG.svelte.format,
      globalName: CONFIG.svelte.globalName,
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
  await buildTailwind();
  await buildExtension();
  console.log("🎉 Build complete!");
}

runBuild().catch((err) => {
  console.error("💥 Build failed:", err);
  process.exit(1);
});

async function buildTailwind(): Promise<void> {
  for (const file of CONFIG.tailwind.io) {
    const cssInput = file.in
      ? await fs.promises.readFile(file.in, "utf8")
      : '@import "tailwindcss";';

    const isRepl = file.out.kind === "repl";
    const result = await postcss([
      tailwindcss({
        content: CONFIG.tailwind.contentGlobs,
      } as any),
    ]).process(cssInput, {
      from: file.in || SRC,
      to: isRepl ? BUILD : file.out.value,
      map: false,
    });

    let content = result.css;
    if (isRepl) {
      content = await fs.promises.readFile(file.out.value, "utf8");
      content = content.replace(
        '/* @import "tailwindcss"; */',
        escapeCSS(result.css),
      );
    }
    await fs.promises.writeFile(file.out.value, content);

    console.log(
      `✅ TailwindCSS compiled to ${path.relative(ROOT, file.out.value)}`,
    );
  }
}

const sveltePlugin: Plugin = {
  name: "svelte",
  setup(build: PluginBuild) {
    build.onLoad({ filter: /\.svelte$/ }, async (args) => {
      const source = await fs.promises.readFile(args.path, "utf8");
      const { js, warnings } = compile(source, {
        filename: args.path,
        generate: "client",
      });
      if (warnings.length) {
        for (const warning of warnings) {
          console.warn(warning);
        }
      }
      return {
        contents: js.code,
        loader: "js",
      };
    });
  },
};
