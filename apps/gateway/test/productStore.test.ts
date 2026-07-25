import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import { FileProductStore } from "../src/productStore.ts";

test("FileProductStore preserves corrupt data instead of replacing it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pf-product-store-"));
  const file = join(directory, "state.json");
  await writeFile(file, "{corrupt", "utf8");

  try {
    const store = new FileProductStore(file);
    await assert.rejects(() => store.listScenes(), SyntaxError);
    assert.equal(await readFile(file, "utf8"), "{corrupt");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("FileProductStore serializes concurrent first writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pf-product-store-"));
  const file = join(directory, "state.json");

  try {
    const store = new FileProductStore(file);
    await Promise.all([
      store.upsertProfile({ id: "profile-a", name: "A" }),
      store.upsertProfile({ id: "profile-b", name: "B" }),
    ]);

    const reloaded = new FileProductStore(file);
    const state = await reloaded.getState();
    assert.deepEqual(state.profiles.map((profile) => profile.id).sort(), ["profile-a", "profile-b"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
