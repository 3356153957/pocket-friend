import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canContinueQuiz,
  createInitialPrefs,
  toggleInterest,
} from "../src/app/appFlow.ts";

describe("Pocket Friend app flow", () => {
  test("starts with an unanswered questionnaire and default pendant settings", () => {
    assert.deepEqual(createInitialPrefs(), {
      interests: [],
      radius: 300,
      quiet: false,
    });
  });

  test("requires a vibe, three interests, and a meeting style", () => {
    assert.equal(canContinueQuiz(createInitialPrefs()), false);
    assert.equal(canContinueQuiz({
      ...createInitialPrefs(),
      vibe: "quiet",
      interests: ["咖啡", "散步"],
      meetStyle: "chat",
    }), false);
    assert.equal(canContinueQuiz({
      ...createInitialPrefs(),
      vibe: "quiet",
      interests: ["咖啡", "散步", "电影"],
      meetStyle: "chat",
    }), true);
  });

  test("toggles an interest without mutating or duplicating the current list", () => {
    const current = ["咖啡", "散步"];

    assert.deepEqual(toggleInterest(current, "电影"), ["咖啡", "散步", "电影"]);
    assert.deepEqual(toggleInterest(current, "咖啡"), ["散步"]);
    assert.deepEqual(current, ["咖啡", "散步"]);
  });
});
