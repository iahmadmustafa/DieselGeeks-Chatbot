import * as esbuild from "esbuild";
import { constants } from "node:fs";
import { access, copyFile, mkdir, stat, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const outfile = resolve(rootDir, "public", "dieselgeeks-chat.js");
const logoSource = resolve(__dirname, "src", "assets", "logo.png");
const logoOutput = resolve(rootDir, "public", "dr-diesel-logo.png");
const heroBgSource = resolve(rootDir, "src", "assests", "background.png");
const heroBgOutput = resolve(rootDir, "public", "dg-hero-bg.jpg");
const heroBgLegacyPng = resolve(rootDir, "public", "dg-hero-bg.png");

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

/**
 * Compress the hero photo into a ~1920px-wide JPEG. The raw PNG was ~1.5MB
 * and, with any glass UI on top, kept the GPU busy during hover/click.
 * Missing source/output is non-fatal: HeroChat falls back to CSS gradients.
 */
function tryOptimizeHeroBackgroundWindows() {
  const script = `
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Drawing
  $img = [System.Drawing.Image]::FromFile('${heroBgSource.replace(/\\/g, "\\\\")}')
  $maxW = 1920
  $w = $img.Width
  $h = $img.Height
  if ($w -gt $maxW) {
    $h = [int]([math]::Round($h * ($maxW / [double]$w)))
    $w = $maxW
  }
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, 72L)
  $bmp.Save('${heroBgOutput.replace(/\\/g, "\\\\")}', $codec, $params)
  $img.Dispose(); $bmp.Dispose(); $g.Dispose(); $params.Dispose()
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

async function prepareHeroBackground() {
  await mkdir(dirname(heroBgOutput), { recursive: true });

  const hasSource = await fileExists(heroBgSource);
  if (!hasSource) {
    const hasOutput = await fileExists(heroBgOutput);
    if (hasOutput) {
      console.log(`[build:widget] Hero background source missing; using committed ${heroBgOutput}`);
    } else {
      console.warn(
        `[build:widget] No hero background found at ${heroBgSource}; HeroChat will use its CSS gradient only.`,
      );
    }
    return;
  }

  const sourceStat = await stat(heroBgSource);
  console.log(`[build:widget] Hero background source: ${heroBgSource} (${sourceStat.size} bytes)`);

  if (process.platform === "win32") {
    console.log("[build:widget] Compressing hero background to JPEG (max 1920px, q72)...");
    const result = tryOptimizeHeroBackgroundWindows();
    if (result.ok) {
      const outputStat = await stat(heroBgOutput);
      console.log(`[build:widget] Hero background optimized -> ${heroBgOutput} (${outputStat.size} bytes)`);
      // Drop the old PNG so we don't keep shipping a 1.5MB unused asset.
      if (await fileExists(heroBgLegacyPng)) {
        await unlink(heroBgLegacyPng);
        console.log(`[build:widget] Removed legacy ${heroBgLegacyPng}`);
      }
      return;
    }
    console.warn("[build:widget] Hero JPEG optimization failed (non-fatal):", result.details);
  }

  // Non-Windows / failed optimize: still avoid shipping the raw multi‑MB PNG
  // as .jpg with a wrong format — copy only if we have no better output yet.
  if (await fileExists(heroBgOutput)) {
    const outputStat = await stat(heroBgOutput);
    console.log(`[build:widget] Using existing hero background at ${heroBgOutput} (${outputStat.size} bytes)`);
    return;
  }

  await copyFile(heroBgSource, heroBgOutput);
  const outputStat = await stat(heroBgOutput);
  console.warn(
    `[build:widget] Raw hero background copied to ${heroBgOutput} (${outputStat.size} bytes). Optimize to JPEG for production.`,
  );
}

await mkdir(dirname(outfile), { recursive: true });
await prepareLogo();
await prepareHeroBackground();

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
