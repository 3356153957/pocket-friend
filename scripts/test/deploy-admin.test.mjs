import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import { validateAdminDeployConfig } from "../deploy-admin-lib.mjs";

describe("admin production deployment", () => {
  test("accepts dedicated absolute paths and rejects a root deployment", () => {
    assert.deepEqual(validateAdminDeployConfig({
      deployRoot: "/srv/pocket-friend-admin",
      envFile: "/etc/pocket-friend/admin.env",
      service: "pocket-friend-admin.service",
      healthUrl: "http://127.0.0.1:4311/health",
      workspace: "/runner/work/pocket-friend",
    }), {
      deployRoot: path.resolve("/srv/pocket-friend-admin"),
      envFile: path.resolve("/etc/pocket-friend/admin.env"),
      service: "pocket-friend-admin.service",
      healthUrl: "http://127.0.0.1:4311/health",
      workspace: path.resolve("/runner/work/pocket-friend"),
    });

    assert.throws(() => validateAdminDeployConfig({
      deployRoot: "/",
      envFile: "/etc/pocket-friend/admin.env",
      service: "pocket-friend-admin.service",
      healthUrl: "http://127.0.0.1:4311/health",
      workspace: "/runner/work/pocket-friend",
    }), /deploy root/);
  });

  test("ships a separate hardened service on port 4311", async () => {
    const unit = await readFile(path.resolve("ops/pocket-friend-admin.service"), "utf8");
    assert.match(unit, /User=pf-web/);
    assert.match(unit, /EnvironmentFile=\/etc\/pocket-friend\/admin\.env/);
    assert.match(unit, /ADMIN_PORT=4311/);
    assert.match(unit, /PF_DEVICE_HEARTBEAT_TOKEN_FILE=\/srv\/pocket-friend-admin\/device-heartbeat-token\.json/);
    assert.match(unit, /PF_PHOTO_DOWNLOAD_TOKEN_FILE=\/srv\/pocket-friend-admin\/photo-download-token\.json/);
    assert.doesNotMatch(unit, /CAP_NET_BIND_SERVICE|PORT=80/);
    assert.match(unit, /NoNewPrivileges=true/);
  });

  test("installer generates secrets instead of tracking fixed credentials", async () => {
    const installer = await readFile(path.resolve("ops/install-pocket-friend-admin.sh"), "utf8");
    assert.match(installer, /openssl rand/);
    assert.match(installer, /pocket-friend-admin\.service/);
    assert.match(installer, /4311\/tcp/);
    assert.match(installer, /PF_PHOTO_DOWNLOAD_TOKEN/);
    assert.doesNotMatch(installer, /PF_ADMIN_PASSWORD=['\"][^$]/);
    assert.doesNotMatch(installer, /PF_DEVICE_HEARTBEAT_TOKEN=['\"][^$]/);
    assert.doesNotMatch(installer, /PF_PHOTO_DOWNLOAD_TOKEN=['\"][^$]/);
  });

  test("deployment bootstraps hashed device and photo tokens outside releases", async () => {
    const deployer = await readFile(path.resolve("scripts/deploy-admin.mjs"), "utf8");
    assert.match(deployer, /photo-download-token\.json/);
    assert.match(deployer, /device-heartbeat-token\.json/);
    assert.match(deployer, /createHash\("sha256"\)/);
    assert.match(deployer, /randomBytes\(32\)\.toString\("hex"\)/);
    assert.match(deployer, /label: "Photo download token"/);
    assert.match(deployer, /label: "Device heartbeat token"/);
    assert.match(deployer, /console\.log\(`\$\{label\} generated: \$\{token\}`\)/);
    assert.doesNotMatch(deployer, /PF_ADMIN_PASSWORD/);
  });
});
