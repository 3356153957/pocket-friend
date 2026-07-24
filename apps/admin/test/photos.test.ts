import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import { LatestPhotoStore } from "../src/photos.ts";

test("latest photos persist across store instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pf-admin-photos-"));
  try {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]);
    const first = new LatestPhotoStore({ directory });
    await first.put("board-a", jpeg, Date.parse("2026-07-24T22:55:00.000+08:00"));

    const second = new LatestPhotoStore({ directory });
    const photo = await second.get("board-a");

    assert.equal(photo?.capturedAt, "2026-07-24T14:55:00.000Z");
    assert.deepEqual(photo?.bytes, jpeg);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
