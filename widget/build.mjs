import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const outfile = resolve(rootDir, "public", "dieselgeeks-chat.js");
const logoSource = resolve(__dirname, "src", "assets", "logo.png");
const logoOutput = resolve(rootDir, "public", "dr-diesel-logo.png");

function optimizeLogo() {
  const script = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${logoSource.replace(/\\/g, "\\\\")}')
$size = 96
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, $size, $size)
$bmp.Save('${logoOutput.replace(/\\/g, "\\\\")}', [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose(); $bmp.Dispose(); $g.Dispose()
`;
  const result = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", script],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error("Failed to optimize widget logo");
  }
}

await mkdir(dirname(outfile), { recursive: true });
optimizeLogo();

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
