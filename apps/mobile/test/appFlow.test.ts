import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canContinueQuiz,
  createInitialPrefs,
  toggleInterest,
} from "../src/app/appFlow.ts";
import {
  calculateEncounterProfile,
  deriveLegacyMatchingPrefs,
  isQuizComplete,
  type CompletedQuizAnswers,
} from "../src/app/encounterProfile.ts";

describe("Pocket Friend app flow", () => {
  test("starts with an unanswered questionnaire and default pendant settings", () => {
    assert.deepEqual(createInitialPrefs(), {
      interests: [],
      quizAnswers: {},
      radius: 300,
      quiet: false,
    });
  });

  test("requires derived matching prefs before continuing to the pendant", () => {
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

  test("requires all five encounter questions before calculating the profile", () => {
    assert.equal(isQuizComplete({ q1: "A", q2: "A", q3: "A", q4: "A" }), false);
    assert.equal(isQuizComplete({ q1: "A", q2: "A", q3: "A", q4: "B", q5: "A" }), true);
  });

  test("calculates the encounter profile and legacy matching fields", () => {
    const answers: CompletedQuizAnswers = {
      q1: "A",
      q2: "A",
      q3: "A",
      q4: "B",
      q5: "A",
    };
    const profile = calculateEncounterProfile(answers);

    assert.equal(profile.archetype, "安静观察者");
    assert.equal(profile.firstMeetStyle, "直接聊天");
    assert.equal(profile.encounterPreference, "深聊");
    assert.equal(profile.sceneType, "户外游走");
    assert.deepEqual(profile.sceneTags, ["城市漫步", "公园", "户外散步"]);
    assert.equal(profile.privacyMode, "需确认");
    assert.match(profile.displayText, /观察气氛/);

    assert.deepEqual(deriveLegacyMatchingPrefs(profile), {
      vibe: "quiet",
      interests: ["城市漫步", "公园", "户外散步"],
      meetStyle: "chat",
    });
  });

  test("toggles an interest without mutating or duplicating the current list", () => {
    const current = ["咖啡", "散步"];

    assert.deepEqual(toggleInterest(current, "电影"), ["咖啡", "散步", "电影"]);
    assert.deepEqual(toggleInterest(current, "咖啡"), ["散步"]);
    assert.deepEqual(current, ["咖啡", "散步"]);
  });
});
