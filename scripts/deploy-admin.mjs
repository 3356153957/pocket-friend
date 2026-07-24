#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  cp,
  lstat,
  mkdir,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  buildReleaseName,
  validateDeployIdentity,
  validateReleaseTarget,
} from "./deploy-production-lib.mjs";
import {
  assertAdminSourcePath,
  validateAdminDeployConfig,
  waitForAdminHealth,
} from "./deploy-admin-lib.mjs";

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: options.cwd, stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit" });
    let stdout = "";
    if (options.capture) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
    }
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function pathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function ensureHashedToken({ file, label }) {
  const tokenFile = file;
  if (await pathExists(tokenFile)) {
    return null;
  }

  const token = randomBytes(32).toString("hex");
  const record = {
    digest: createHash("sha256").update(token).digest("hex"),
    createdAt: new Date().toISOString(),
  };
  await writeFile(tokenFile, JSON.stringify(record), { mode: 0o644 });
  console.log(`${label} generated: ${token}`);
  return token;
}

async function ensureServerTokens(config) {
  await ensureHashedToken({
    file: path.join(config.deployRoot, "photo-download-token.json"),
    label: "Photo download token",
  });
  await ensureHashedToken({
    file: path.join(config.deployRoot, "device-heartbeat-token.json"),
    label: "Device heartbeat token",
  });
}

async function replaceSymlink(link, target, temporaryLink) {
  await rm(temporaryLink, { force: true });
  await symlink(target, temporaryLink, "dir");
  await rename(temporaryLink, link);
}

async function currentRelease(currentLink) {
  try {
    const info = await lstat(currentLink);
    if (!info.isSymbolicLink()) throw new Error(`${currentLink} must be a symbolic link`);
    return await readlink(currentLink);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function main() {
  const config = validateAdminDeployConfig({
    deployRoot: process.env.PF_ADMIN_DEPLOY_ROOT,
    envFile: process.env.PF_ADMIN_ENV_FILE,
    service: process.env.PF_ADMIN_SERVICE,
    healthUrl: process.env.PF_ADMIN_HEALTH_URL,
    workspace: process.env.GITHUB_WORKSPACE,
  });
  const identity = validateDeployIdentity({
    sha: process.env.GITHUB_SHA,
    runId: process.env.GITHUB_RUN_ID,
    attempt: process.env.GITHUB_RUN_ATTEMPT,
  });
  const checkedOutSha = await run("git", ["rev-parse", "HEAD"], { cwd: config.workspace, capture: true });
  if (checkedOutSha !== identity.sha) throw new Error("Checked out commit does not match GITHUB_SHA");

  const releaseName = buildReleaseName(identity);
  const releasesRoot = path.join(config.deployRoot, "releases");
  const incoming = path.join(releasesRoot, `.incoming-${releaseName}`);
  const release = path.join(releasesRoot, releaseName);
  const currentLink = path.join(config.deployRoot, "current");
  const temporaryLink = path.join(config.deployRoot, `.current-${releaseName}`);
  const rollbackLink = path.join(config.deployRoot, `.rollback-${releaseName}`);
  const source = assertAdminSourcePath(config.workspace);

  await mkdir(releasesRoot, { recursive: true });
  if (await pathExists(incoming) || await pathExists(release)) throw new Error(`Admin release already exists: ${releaseName}`);
  await cp(source, incoming, { recursive: true, errorOnExist: true, force: false });
  await rename(incoming, release);

  const previousLink = await currentRelease(currentLink);
  const previous = previousLink ? await validateReleaseTarget({ deployRoot: config.deployRoot, target: previousLink }) : null;
  await replaceSymlink(currentLink, release, temporaryLink);
  try {
    await ensureServerTokens(config);
    await run("sudo", ["-n", "systemctl", "restart", config.service]);
    await waitForAdminHealth({ healthUrl: config.healthUrl });
  } catch (error) {
    if (!previous) throw new Error(`Admin deployment failed and no previous release exists: ${error.message}`);
    await replaceSymlink(currentLink, previous, rollbackLink);
    await run("sudo", ["-n", "systemctl", "restart", config.service]);
    await waitForAdminHealth({ healthUrl: config.healthUrl });
    throw new Error(`Admin deployment failed and was rolled back: ${error.message}`);
  }

  console.log(`Admin deployment succeeded: ${releaseName}`);
}

main().catch((error) => {
  console.error(`Admin deployment failed: ${error.message}`);
  process.exitCode = 1;
});
