import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { findSensitiveMatches } from "../scan-public-build.mjs";

test("scanner accepts ordinary static text", () => {
  assert.deepEqual(findSensitiveMatches("Pocket Friend public demo"), []);
});

test("scanner rejects credential signatures without returning their values", () => {
  const bearer = findSensitiveMatches("Authorization: Bearer abcdefghijklmnopqrstuvwxyz");
  const privateKey = findSensitiveMatches("-----BEGIN PRIVATE KEY-----");

  assert.deepEqual(bearer, ["bearer-token"]);
  assert.deepEqual(privateKey, ["private-key"]);
});

test("scanner rejects legacy hosting and private service addresses", () => {
  assert.deepEqual(
    findSensitiveMatches("https://pocket-friend-map.h1879202922.chatgpt.site"),
    ["legacy-sites-host"],
  );
  assert.deepEqual(findSensitiveMatches("http://example.test:4311/api"), ["private-service-port"]);
  assert.deepEqual(findSensitiveMatches("compiled fallback :4311/island-photo-api"), ["private-service-port"]);
});

test("Pages packaging writes an SPA fallback and restrictive security headers", async () => {
  const source = await readFile(new URL("../prepare-cloudflare-static.mjs", import.meta.url), "utf8");
  assert.match(source, /_headers/);
  assert.match(source, /_redirects/);
  assert.match(source, /Content-Security-Policy/);
  assert.match(source, /connect-src 'none'/);
});

test("legacy Sites binding is absent and Wrangler state is ignored", async () => {
  const ignore = await readFile(new URL("../../.gitignore", import.meta.url), "utf8");
  assert.match(ignore, /^\.wrangler\/$/m);
  await assert.rejects(
    readFile(new URL("../../.openai/hosting.json", import.meta.url), "utf8"),
    { code: "ENOENT" },
  );
});
