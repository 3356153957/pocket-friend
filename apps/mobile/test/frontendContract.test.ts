import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";

const mobileRoot = new URL("../", import.meta.url);

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, mobileRoot), "utf8");
}

describe("Spark Connect frontend contract", () => {
  test("uses Pocket Friend branding without the old Orbit name", async () => {
    const sources = await Promise.all([
      read("index.html"),
      read("src/App.tsx"),
      read("src/components/TopBar.tsx"),
      read("src/components/Welcome.tsx"),
    ]);
    const combined = sources.join("\n");

    assert.match(combined, /Pocket Friend/);
    assert.doesNotMatch(combined, /Orbit/);
  });

  test("keeps all five demo stages as dedicated components", async () => {
    const app = await read("src/App.tsx");

    for (const component of [
      "Welcome",
      "Quiz",
      "PendantSetup",
      "MatchingMap",
      "HomeWorld",
    ]) {
      assert.match(app, new RegExp(component));
    }
  });

  test("defines small-screen and reduced-motion behavior", async () => {
    const styles = await read("src/styles.css");

    assert.match(styles, /@media \(max-width: 480px\)/);
    assert.match(styles, /prefers-reduced-motion: reduce/);
    assert.match(styles, /min-height: 44px/);
  });

  test("clips the animated pendant hero within the mobile viewport", async () => {
    const welcome = await read("src/components/Welcome.tsx");

    assert.match(welcome, /aspect-square[^\"]*overflow-hidden/);
  });

  test("ships a Pocket Friend favicon without a missing-resource request", async () => {
    const [html, favicon] = await Promise.all([
      read("index.html"),
      read("public/favicon.svg"),
    ]);

    assert.match(html, /href="\/favicon\.svg"/);
    assert.match(favicon, /Pocket Friend/);
  });
});
