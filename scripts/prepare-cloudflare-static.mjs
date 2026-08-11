import {
  access,
  cp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webBuild = resolve(repositoryRoot, "dist", "web");
const cloudflareBuild = resolve(repositoryRoot, "dist", "cloudflare");

await access(resolve(webBuild, "index.html"));
await rm(cloudflareBuild, { force: true, recursive: true });
await mkdir(cloudflareBuild, { recursive: true });
await cp(webBuild, cloudflareBuild, { recursive: true });

await writeFile(
  resolve(cloudflareBuild, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`,
  "utf8",
);

await writeFile(
  resolve(cloudflareBuild, "_redirects"),
  "/* /index.html 200\n",
  "utf8",
);

console.log(`Prepared Cloudflare Pages bundle: ${cloudflareBuild}`);
