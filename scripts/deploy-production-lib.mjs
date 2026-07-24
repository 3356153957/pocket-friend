import { readFile } from "node:fs/promises";
import path from "node:path";

export const REQUIRED_PUBLIC_ENV_NAMES = Object.freeze([
  "EXPO_PUBLIC_AMAP_KEY",
  "EXPO_PUBLIC_AMAP_SECURITY_JS_CODE",
]);

function unquote(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value.at(-1);
    if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

export function parseEnvFile(source) {
  const parsed = {};

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsAt = line.indexOf("=");
    if (equalsAt < 1) {
      continue;
    }

    const name = line.slice(0, equalsAt).trim();
    if (!REQUIRED_PUBLIC_ENV_NAMES.includes(name)) {
      continue;
    }
    parsed[name] = unquote(line.slice(equalsAt + 1).trim());
  }

  for (const name of REQUIRED_PUBLIC_ENV_NAMES) {
    if (!parsed[name]?.trim()) {
      throw new Error(`Missing required deployment variable: ${name}`);
    }
  }

  return parsed;
}

export function resolveAssetPath(buildRoot, publicPath) {
  if (
    typeof publicPath !== "string" ||
    !publicPath.endsWith(".js") ||
    publicPath.includes("://") ||
    publicPath.startsWith("//") ||
    publicPath.includes("\\")
  ) {
    throw new Error("Expected a local JavaScript asset path");
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(publicPath);
  } catch {
    throw new Error("Expected a local JavaScript asset path");
  }

  if (decodedPath.split("/").includes("..")) {
    throw new Error("Asset path resolves outside build root");
  }

  const normalizedRoot = path.resolve(buildRoot);
  const candidate = path.resolve(normalizedRoot, decodedPath.replace(/^\/+/u, ""));
  const relative = path.relative(normalizedRoot, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Asset path resolves outside build root");
  }

  return candidate;
}

export async function validateBuild({ buildRoot, publicEnv }) {
  const indexFile = path.join(path.resolve(buildRoot), "index.html");
  const html = await readFile(indexFile, "utf8");
  const assetPublicPath = extractScriptAssetPath(html);
  const assetFile = resolveAssetPath(buildRoot, assetPublicPath);
  const bundle = await readFile(assetFile, "utf8");

  for (const name of REQUIRED_PUBLIC_ENV_NAMES) {
    const value = publicEnv[name];
    if (!value?.trim()) {
      throw new Error(`Missing required deployment variable: ${name}`);
    }
    if (!bundle.includes(value)) {
      throw new Error(`Built JavaScript does not contain ${name}`);
    }
  }

  return { assetPublicPath, assetFile };
}

export function extractScriptAssetPath(html) {
  const scriptMatch = html.match(/<script\b[^>]*\bsrc="([^"]+\.js)"[^>]*>/iu);
  if (!scriptMatch) {
    throw new Error("Build index does not reference a local JavaScript asset");
  }
  return scriptMatch[1];
}

export function validateDeployIdentity({ sha, runId, attempt }) {
  if (!/^[0-9a-f]{40}$/u.test(sha ?? "")) {
    throw new Error("GITHUB_SHA must be a full lowercase Git commit SHA");
  }
  if (!/^[0-9]+$/u.test(runId ?? "")) {
    throw new Error("GITHUB_RUN_ID must contain digits only");
  }
  if (!/^[0-9]+$/u.test(attempt ?? "")) {
    throw new Error("GITHUB_RUN_ATTEMPT must contain digits only");
  }

  return { sha, runId, attempt };
}

export function buildReleaseName(identity) {
  const { sha, runId, attempt } = validateDeployIdentity(identity);
  return `${sha}-${runId}-${attempt}`;
}

export function validateDeployConfig({
  deployRoot,
  envFile,
  service,
  healthUrl,
  workspace,
}) {
  const normalizedDeployRoot = path.resolve(deployRoot ?? "");
  if (
    !path.isAbsolute(deployRoot ?? "") ||
    normalizedDeployRoot === path.parse(normalizedDeployRoot).root
  ) {
    throw new Error("PF_DEPLOY_ROOT must be a non-root absolute deploy root");
  }

  const normalizedEnvFile = path.resolve(envFile ?? "");
  if (!path.isAbsolute(envFile ?? "")) {
    throw new Error("PF_DEPLOY_ENV_FILE must be an absolute path");
  }

  const normalizedWorkspace = path.resolve(workspace ?? "");
  if (!path.isAbsolute(workspace ?? "")) {
    throw new Error("GITHUB_WORKSPACE must be an absolute path");
  }

  if (!/^[A-Za-z0-9@_.-]+\.service$/u.test(service ?? "")) {
    throw new Error("PF_DEPLOY_SERVICE must be a valid systemd service name");
  }

  let parsedHealthUrl;
  try {
    parsedHealthUrl = new URL(healthUrl);
  } catch {
    throw new Error("PF_DEPLOY_HEALTH_URL must be a valid loopback HTTP URL");
  }
  if (
    parsedHealthUrl.protocol !== "http:" ||
    !["127.0.0.1", "::1", "localhost"].includes(parsedHealthUrl.hostname)
  ) {
    throw new Error("PF_DEPLOY_HEALTH_URL must use loopback HTTP");
  }

  return {
    deployRoot: normalizedDeployRoot,
    envFile: normalizedEnvFile,
    service,
    healthUrl: parsedHealthUrl.toString(),
    workspace: normalizedWorkspace,
  };
}
