#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readlink,
  rename,
  symlink,
} from "node:fs/promises";
import path from "node:path";

import {
  buildReleaseName,
  extractScriptAssetPath,
  parseEnvFile,
  validateBuild,
  validateDeployConfig,
  validateDeployIdentity,
} from "./deploy-production-lib.mjs";

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });
    let stdout = "";
    if (options.capture) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
    }
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(
        `${command} exited with ${code ?? `signal ${signal ?? "unknown"}`}`,
      ));
    });
  });
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function readCurrentRelease(currentLink) {
  try {
    const stats = await lstat(currentLink);
    if (!stats.isSymbolicLink()) {
      throw new Error(`${currentLink} must be a symbolic link`);
    }
    return await readlink(currentLink);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function replaceSymlink({ currentLink, target, temporaryLink }) {
  if (await pathExists(temporaryLink)) {
    throw new Error(`Temporary deployment link already exists: ${temporaryLink}`);
  }
  await symlink(target, temporaryLink, "dir");
  await rename(temporaryLink, currentLink);
}

async function checkHealth(healthUrl) {
  const indexResponse = await fetch(healthUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(3_000),
  });
  if (!indexResponse.ok) {
    throw new Error(`Health index returned HTTP ${indexResponse.status}`);
  }

  const html = await indexResponse.text();
  const assetPublicPath = extractScriptAssetPath(html);
  const assetUrl = new URL(assetPublicPath, healthUrl);
  if (assetUrl.origin !== new URL(healthUrl).origin) {
    throw new Error("Health index references a non-local JavaScript asset");
  }

  const assetResponse = await fetch(assetUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(3_000),
  });
  if (!assetResponse.ok) {
    throw new Error(`Health asset returned HTTP ${assetResponse.status}`);
  }

  return assetPublicPath;
}

async function waitForHealth(healthUrl) {
  let lastError;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      return await checkHealth(healthUrl);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Health check failed after 10 seconds: ${lastError?.message}`);
}

async function restartService(service) {
  await run("sudo", ["-n", "systemctl", "restart", service]);
}

async function main() {
  const config = validateDeployConfig({
    deployRoot: process.env.PF_DEPLOY_ROOT,
    envFile: process.env.PF_DEPLOY_ENV_FILE,
    service: process.env.PF_DEPLOY_SERVICE,
    healthUrl: process.env.PF_DEPLOY_HEALTH_URL,
    workspace: process.env.GITHUB_WORKSPACE,
  });
  const identity = validateDeployIdentity({
    sha: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
  });
  const releaseName = buildReleaseName(identity);

  const checkedOutSha = await run(
    "git",
    ["rev-parse", "HEAD"],
    { cwd: config.workspace, capture: true },
  );
  if (checkedOutSha !== identity.sha) {
    throw new Error("Checked out commit does not match GITHUB_SHA");
  }

  const publicEnv = parseEnvFile(await readFile(config.envFile, "utf8"));
  const buildEnvironment = {
    ...process.env,
    ...publicEnv,
    CI: "1",
  };

  console.log(`Building production commit ${identity.sha}`);
  await run("npm", ["ci"], {
    cwd: config.workspace,
    env: buildEnvironment,
  });
  await run("npm", ["test"], {
    cwd: config.workspace,
    env: buildEnvironment,
  });
  await run("npm", ["run", "typecheck"], {
    cwd: config.workspace,
    env: buildEnvironment,
  });
  await run("npm", ["run", "build:sites"], {
    cwd: config.workspace,
    env: buildEnvironment,
  });

  const buildRoot = path.join(config.workspace, "dist/client");
  const validatedBuild = await validateBuild({ buildRoot, publicEnv });
  console.log(`Validated build asset ${validatedBuild.assetPublicPath}`);

  const releasesRoot = path.join(config.deployRoot, "releases");
  const incomingRelease = path.join(releasesRoot, `.incoming-${releaseName}`);
  const releaseDirectory = path.join(releasesRoot, releaseName);
  const currentLink = path.join(config.deployRoot, "current");
  const temporaryLink = path.join(config.deployRoot, `.current-${releaseName}`);
  const rollbackLink = path.join(config.deployRoot, `.rollback-${releaseName}`);

  await mkdir(releasesRoot, { recursive: true });
  if (
    await pathExists(incomingRelease) ||
    await pathExists(releaseDirectory)
  ) {
    throw new Error(`Release already exists: ${releaseName}`);
  }

  await cp(buildRoot, incomingRelease, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  await rename(incomingRelease, releaseDirectory);

  const previousRelease = await readCurrentRelease(currentLink);
  await replaceSymlink({
    currentLink,
    target: releaseDirectory,
    temporaryLink,
  });

  try {
    await restartService(config.service);
    const servedAsset = await waitForHealth(config.healthUrl);
    if (servedAsset !== validatedBuild.assetPublicPath) {
      throw new Error("Served asset does not match the newly built release");
    }
  } catch (deploymentError) {
    if (!previousRelease) {
      throw new Error(
        `Deployment failed and no previous release exists: ${deploymentError.message}`,
      );
    }

    await replaceSymlink({
      currentLink,
      target: previousRelease,
      temporaryLink: rollbackLink,
    });
    await restartService(config.service);
    await waitForHealth(config.healthUrl);
    throw new Error(`Deployment failed and was rolled back: ${deploymentError.message}`);
  }

  console.log(`Production deployment succeeded: ${releaseName}`);
}

main().catch((error) => {
  console.error(`Production deployment failed: ${error.message}`);
  process.exitCode = 1;
});
