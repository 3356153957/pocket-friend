import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve, sep } from "node:path";

const configuredRoot = resolve(
  process.env.POCKET_FRIEND_STATIC_ROOT ?? "/srv/pocket-friend/current",
);
const root = await realpath(configuredRoot);
const host = process.env.HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "4320", 10);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
]);

class OutsideRootError extends Error {}

function assertInsideRoot(candidate) {
  const pathFromRoot = relative(root, candidate);
  if (
    pathFromRoot.startsWith("..") ||
    pathFromRoot.includes(`..${sep}`) ||
    resolve(candidate) === resolve(root, "..")
  ) {
    throw new OutsideRootError("Requested file resolves outside static root");
  }
}

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const normalized = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/u, "");
  const candidate = resolve(join(root, normalized));
  assertInsideRoot(candidate);
  return candidate;
}

async function existingFile(candidate) {
  const realCandidate = await realpath(candidate);
  assertInsideRoot(realCandidate);
  const info = await stat(realCandidate);
  if (!info.isDirectory()) {
    return realCandidate;
  }

  const indexFile = await realpath(join(realCandidate, "index.html"));
  assertInsideRoot(indexFile);
  return indexFile;
}

async function findResponseFile(requestUrl) {
  let requestedPath;
  try {
    requestedPath = resolveRequestPath(requestUrl);
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return null;
    }
    throw error;
  }

  try {
    return await existingFile(requestedPath);
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return null;
    }
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
      throw error;
    }
    return existingFile(join(root, "index.html"));
  }
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  try {
    const file = await findResponseFile(request.url ?? "/");
    if (!file) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const fileInfo = await stat(file);
    if (!fileInfo.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Length": fileInfo.size,
      "Content-Type": contentTypes.get(extname(file)) ?? "application/octet-stream",
      "Cache-Control": file.endsWith("index.html")
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(file).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
    console.error(error);
  }
});

server.listen(port, host, () => {
  console.log(`Pocket Friend static server listening on http://${host}:${port}`);
  console.log(`Serving ${root}`);
});
