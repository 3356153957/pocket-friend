import path from "node:path";

import { validateDeployConfig } from "./deploy-production-lib.mjs";

export function validateAdminDeployConfig(input) {
  return validateDeployConfig({
    deployRoot: input.deployRoot,
    envFile: input.envFile,
    service: input.service,
    healthUrl: input.healthUrl,
    workspace: input.workspace,
  });
}

export function assertAdminSourcePath(workspace) {
  const source = path.resolve(workspace, "apps", "admin");
  const relative = path.relative(path.resolve(workspace), source);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Admin source must remain inside the workspace");
  }
  return source;
}

export async function waitForAdminHealth({
  healthUrl,
  timeoutMs = 10_000,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  const deadline = now() + timeoutMs;
  let lastError;
  while (now() < deadline) {
    try {
      const response = await fetchImpl(healthUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(Math.max(1, Math.min(2_000, deadline - now()))),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (body?.status !== "ok" || body?.service !== "pocket-friend-admin") {
        throw new Error("unexpected health response");
      }
      return;
    } catch (error) {
      lastError = error;
      const remaining = deadline - now();
      if (remaining > 0) await sleep(Math.min(500, remaining));
    }
  }
  throw new Error(`Admin health check failed after ${timeoutMs} milliseconds: ${lastError?.message}`);
}
