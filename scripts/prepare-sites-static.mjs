import {
  cp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = resolve(repositoryRoot, "dist");
const webBuild = resolve(distRoot, "web");
const staticAssets = resolve(distRoot, "client");
const serverEntry = resolve(distRoot, "server", "index.js");

await rm(staticAssets, { force: true, recursive: true });
await cp(webBuild, staticAssets, { recursive: true });
await mkdir(dirname(serverEntry), { recursive: true });
await writeFile(
  serverEntry,
  `const worker = {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") {
      return response;
    }

    const fallbackUrl = new URL("/index.html", request.url);
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};

export default worker;
`,
  "utf8",
);
