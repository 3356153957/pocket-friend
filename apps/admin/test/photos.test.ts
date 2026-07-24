import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("photo history persists across store instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pf-admin-photos-"));
  try {
    const older = Uint8Array.from([0xff, 0xd8, 0x01, 0xff, 0xd9]);
    const newer = Uint8Array.from([0xff, 0xd8, 0x02, 0xff, 0xd9]);
    const first = new LatestPhotoStore({ directory });
    await first.put("board-a", older, Date.parse("2026-07-24T22:55:00.000+08:00"));
    await first.put("board-a", newer, Date.parse("2026-07-24T23:00:00.000+08:00"));

    const second = new LatestPhotoStore({ directory });
    const history = await second.listHistory("board-a");
    const photo = await second.getHistoryPhoto("board-a", history[0]?.id ?? "");

    assert.deepEqual(history.map(({ capturedAt }) => capturedAt), [
      "2026-07-24T15:00:00.000Z",
      "2026-07-24T14:55:00.000Z",
    ]);
    assert.deepEqual(photo?.bytes, newer);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("photo history persists uploaded subject names", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pf-admin-photos-"));
  try {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0x01, 0xff, 0xd9]);
    const first = new LatestPhotoStore({ directory });
    await first.put(
      "board-a",
      jpeg,
      Date.parse("2026-07-24T22:55:00.000+08:00"),
      { name: "阿狸" },
    );

    const second = new LatestPhotoStore({ directory });
    const history = await second.listHistory("board-a");
    const photo = await second.getHistoryPhoto("board-a", history[0]?.id ?? "");

    assert.equal(history[0]?.name, "阿狸");
    assert.equal(photo?.name, "阿狸");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("photo history infers subject names from name-and-time archive filenames", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pf-admin-photos-"));
  try {
    const capturedAtMs = Date.parse("2026-07-24T22:55:00.000+08:00");
    const capturedAt = new Date(capturedAtMs).toISOString();
    const first = new LatestPhotoStore({ directory });
    await first.put(
      "board-a",
      Uint8Array.from([0xff, 0xd8, 0x01, 0xff, 0xd9]),
      capturedAtMs,
      { name: "阿狸" },
    );
    const uploaded = (await first.listHistory("board-a"))[0];
    assert.ok(uploaded);
    await writeFile(
      join(directory, "history", "board-a", `${uploaded.id}.json`),
      JSON.stringify({ capturedAt }),
    );

    const restarted = new LatestPhotoStore({ directory });
    const history = await restarted.listHistory("board-a");

    assert.equal(history[0]?.name, "阿狸");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("photo history merges new in-memory photos with existing disk history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pf-admin-photos-"));
  try {
    const first = new LatestPhotoStore({ directory });
    await first.put(
      "board-a",
      Uint8Array.from([0xff, 0xd8, 0x01, 0xff, 0xd9]),
      Date.parse("2026-07-24T22:55:00.000+08:00"),
    );
    await first.put(
      "board-a",
      Uint8Array.from([0xff, 0xd8, 0x02, 0xff, 0xd9]),
      Date.parse("2026-07-24T23:00:00.000+08:00"),
    );

    const restarted = new LatestPhotoStore({ directory });
    await restarted.put(
      "board-a",
      Uint8Array.from([0xff, 0xd8, 0x03, 0xff, 0xd9]),
      Date.parse("2026-07-24T23:05:00.000+08:00"),
    );

    const history = await restarted.listHistory("board-a");

    assert.deepEqual(history.map(({ capturedAt }) => capturedAt), [
      "2026-07-24T15:05:00.000Z",
      "2026-07-24T15:00:00.000Z",
      "2026-07-24T14:55:00.000Z",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
