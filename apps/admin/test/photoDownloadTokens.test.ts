import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import { PhotoDownloadTokenStore } from "../src/photoDownloadTokens.ts";

test("generated photo download tokens persist as a server-side hash", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pf-photo-token-"));
  try {
    const file = join(directory, "token.json");
    const first = new PhotoDownloadTokenStore({ file });
    const generated = await first.generate(Date.parse("2026-07-25T02:30:00.000+08:00"));

    assert.equal(generated.token.length, 64);
    assert.equal(await first.verify(generated.token), true);
    assert.equal(await first.verify("wrong"), false);

    const second = new PhotoDownloadTokenStore({ file });
    assert.equal(await second.verify(generated.token), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
