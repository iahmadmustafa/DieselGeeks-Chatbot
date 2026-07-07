import * as esbuild from "esbuild";
import { constants } from "node:fs";
import { access, copyFile, mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const outfile = resolve(rootDir, "public", "dieselgeeks-chat.js");
const logoSource = resolve(__dirname, "src", "assets", "logo.png");
const logoOutput = resolve(rootDir, "public", "dr-diesel-logo.png");

async function fileExists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function tryOptimizeLogoWindows() {
  const script = `
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Drawing
  $img = [System.Drawing.Image]::FromFile('${logoSource.replace(/\\/g, "\\\\")}')
  $size = 96
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $size, $size)
  $bmp.Save('${logoOutput.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png)
  $img.Dispose(); $bmp.Dispose(); $g.Dispose()
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
`;

  const result = spawnSync("powershell", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const details = [result.stderr, result.stdout, result.error?.message]
      .filter(Boolean)
      .join("\n")
      .trim();
    return { ok: false, details: details || `powershell exited with code ${result.status}` };
  }

  return { ok: true };
}

async function prepareLogo() {
  await mkdir(dirname(logoOutput), { recursive: true });

  const hasSource = await fileExists(logoSource);
  const hasOutput = await fileExists(logoOutput);

  if (!hasSource && !hasOutput) {
    throw new Error(
      `[build:widget] No widget logo found. Expected source at ${logoSource} or committed output at ${logoOutput}`,
    );
  }

  if (!hasSource) {
    const outputStat = await stat(logoOutput);
    console.log(
      `[build:widget] Logo source missing; using committed ${logoOutput} (${outputStat.size} bytes)`,
    );
    return;
  }

  const sourceStat = await stat(logoSource);
  console.log(`[build:widget] Logo source: ${logoSource} (${sourceStat.size} bytes)`);

  if (process.platform === "win32") {
    console.log("[build:widget] Attempting Windows logo resize to 96x96...");
    const result = tryOptimizeLogoWindows();
    if (result.ok) {
      const outputStat = await stat(logoOutput);
      console.log(`[build:widget] Logo optimized -> ${logoOutput} (${outputStat.size} bytes)`);
      return;
    }

    console.warn("[build:widget] Logo optimization failed (non-fatal):", result.details);
  } else {
    console.log(
      `[build:widget] Skipping logo resize on ${process.platform} (Windows-only optimization)`,
    );
  }

  if (hasOutput) {
    const outputStat = await stat(logoOutput);
    console.log(
      `[build:widget] Using existing logo at ${logoOutput} (${outputStat.size} bytes)`,
    );
    return;
  }

  console.warn(
    `[build:widget] Falling back to raw logo copy: ${logoSource} -> ${logoOutput}`,
  );
  await copyFile(logoSource, logoOutput);
  const outputStat = await stat(logoOutput);
  console.warn(
    `[build:widget] Raw logo copied (${outputStat.size} bytes). Commit an optimized public/dr-diesel-logo.png for production.`,
  );
}

await mkdir(dirname(outfile), { recursive: true });
await prepareLogo();

await esbuild.build({
  entryPoints: [resolve(__dirname, "src", "index.tsx")],
  bundle: true,
  outfile,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  jsx: "automatic",
  minify: true,
  sourcemap: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
  },
  logLevel: "info",
});

console.log(`Widget built -> ${outfile}`);
