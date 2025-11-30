import path from "path";
import fs from "fs";
import { compile } from "svelte/compiler";
import { cp } from "node:fs/promises";
import { escapeCSS } from "./src/utils.ts";
import { spawn } from "child_process";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const PUBLIC = path.join(ROOT, "public");
const BUILD = path.join(ROOT, "dist");

type TailwindIO = {
  isReplacing?: boolean;
  path: string;
};

const CONFIG = {
  filesToBuild: ["background.ts", "content.ts", "popup.ts"],

  extension: {
    artifactsDir: BUILD,
    filename: "dark-mode.xpi",
  },

  tailwind: {
    io: [
      {
        path: path.join(BUILD, "popup.css"),
      },
      {
        isReplacing: true,
        path: path.join(BUILD, "content.js"),
      },
    ] as TailwindIO[],
  },

  svelte: {
    globalName: "app",
    format: "iife",
  },
};

function rmrf(dir: string) {
  fs.rmSync(BUILD, { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
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

async function getAllSvelteFiles(dir: string) {
  const files: string[] = [];

  async function walk(currentDir: string) {
    const entries = await fs.promises.readdir(currentDir, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".svelte")) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

async function compileSvelteFile(path: string) {
  const source = await fs.promises.readFile(path, "utf8");
  const { js, warnings } = compile(source, {
    filename: path,
    generate: "client",
  });

  if (warnings.length) {
    for (const warning of warnings) {
      console.warn(warning.code);
      if (warning.filename && warning.position) {
        console.log(
          `${warning.filename}:${warning.position[0]}:${warning.position[1]}`,
        );
      }
      console.warn(warning.stack);
      console.warn(warning.message);
    }
  }

  return js.code;
}

async function buildScripts() {
  const svelteFiles = await getAllSvelteFiles(SRC);
  const ogFilePostfix = ".og";

  await Promise.all(
    svelteFiles.map(async (file) => {
      const compiledJS = await compileSvelteFile(file);
      await fs.promises.rename(file, file + ogFilePostfix);
      await fs.promises.writeFile(file, compiledJS);
    }),
  );

  const css = runCommand("tailwindcss", ["-o", "-"], {
    captureOutput: true,
  }).then((result) => {
    if (!result.stdout) {
      throw `TailwindCSS Error: ${result.stderr || "No CSS was generated"}`;
    }

    return escapeCSS(result.stdout);
  });

  try {
    await Promise.all(
      CONFIG.filesToBuild.map(async (input) => {
        await runCommand("esbuild", [
          path.join(SRC, input),
          "--bundle",
          "--minify",
          "--sourcemap",
          `--outfile=${path.join(BUILD, input.replace(/\.ts$/, ".js"))}`,
          "--platform=browser",
          "--target=es2020",
          `--format=${CONFIG.svelte.format}`,
          `--global-name=${CONFIG.svelte.globalName}`,
          "--loader:.svelte=js",
        ]);

        console.log(`✅ Built ${input}`);
      }),
    );
  } finally {
    Promise.all(
      svelteFiles.map(async (file) => {
        await fs.promises.rename(file + ogFilePostfix, file);
      }),
    );
  }

  await buildCss(await css);
}

async function buildCss(css: string) {
  await Promise.all(
    CONFIG.tailwind.io.map(async (file) => {
      if (file.isReplacing) {
        let content = await fs.promises.readFile(file.path, "utf8");
        content = content.replace('/* @import "tailwindcss"; */', css);
        await fs.promises.writeFile(file.path, content);
      } else {
        await fs.promises.writeFile(file.path, css);
      }

      console.log(
        `✅ TailwindCSS compiled to ${path.relative(ROOT, file.path)}`,
      );
    }),
  );
}

async function packageExtension() {
  const files = fs
    .readdirSync(BUILD)
    .filter((f) => f !== CONFIG.extension.filename);

  await runCommand("bsdtar", [
    "-C",
    CONFIG.extension.artifactsDir,
    "--format=zip",
    "--options=compression-level=9",
    "-cf",
    path.join(BUILD, CONFIG.extension.filename),
    ...files,
  ]);
  console.log(`✅ Extension packaged to ${CONFIG.extension.filename}`);
}

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  captureOutput?: boolean;
}

export async function runCommand(
  cmd: string,
  args: string[] = [],
  options: RunCommandOptions = {},
): Promise<{ code: number; stdout?: string; stderr?: string }> {
  return new Promise((resolve, reject) => {
    const { captureOutput, cwd, env } = options;
    const id = `${cmd} ${args.join(" ")}`;

    const child = spawn(cmd, args, {
      cwd,
      env: env ?? process.env,
      stdio: captureOutput
        ? ["inherit", "pipe", "pipe"]
        : ["inherit", "inherit", "inherit"],
    });

    let stdout = "";
    let stderr = "";

    if (captureOutput) {
      child.stdout!.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr!.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("error", (err) => reject(err));

    child.on("close", (code) => {
      if (code === null) {
        return reject(
          new Error(`[${id}] Process terminated without exit code`),
        );
      }
      if (code !== 0) {
        return reject(
          new Error(`[${id}] Process terminated with code ${code}\n${stderr}`),
        );
      }

      resolve({
        code,
        stdout: captureOutput ? stdout : undefined,
        stderr: captureOutput ? stderr : undefined,
      });
    });
  });
}

async function runBuild() {
  const msg = "🎉 Build complete";
  console.time(msg);
  rmrf(BUILD);
  await Promise.all([copyPublicContents(), buildScripts()]);
  await packageExtension();
  console.timeEnd(msg);
}

runBuild().catch((err) => {
  console.error("💥 Build failed:", err);
  process.exit(1);
});
