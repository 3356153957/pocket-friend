import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createInitialPrefs, type Prefs } from "../src/app/appFlow.ts";
import Quiz from "../src/components/Quiz.tsx";

afterEach(cleanup);

function renderQuiz(overrides: { onNext?: () => void } = {}) {
  let prefs: Prefs = createInitialPrefs();
  const setPrefs = vi.fn((next: Prefs) => {
    prefs = next;
  });
  const onNext = overrides.onNext ?? vi.fn();
  const view = render(
    <Quiz prefs={prefs} setPrefs={setPrefs} onNext={onNext} onBack={vi.fn()} />,
  );
  return { view, setPrefs, latestPrefs: () => prefs };
}

function answerEveryQuestion(container: HTMLElement) {
  for (const fieldset of container.querySelectorAll("fieldset")) {
    const firstOption = fieldset.querySelector("button");
    if (firstOption) fireEvent.click(firstOption);
  }
}

describe("Quiz", () => {
  test("keeps profile generation locked until every question is answered", () => {
    const { view } = renderQuiz();
    const generate = () =>
      screen.getByText(/生成遇见画像/).closest("button") as HTMLButtonElement;

    expect(generate().disabled).toBe(true);
    answerEveryQuestion(view.container);
    expect(generate().disabled).toBe(false);
  });

  test("generates an encounter profile and hands off to the next step", () => {
    const onNext = vi.fn();
    const { view, latestPrefs } = renderQuiz({ onNext });

    answerEveryQuestion(view.container);
    fireEvent.click(screen.getByText(/生成遇见画像/).closest("button")!);

    const profile = latestPrefs().encounterProfile;
    expect(profile).toBeDefined();
    expect(profile!.sceneTags.length).toBeGreaterThanOrEqual(3);
    screen.getByText(profile!.archetype);

    fireEvent.click(screen.getByText(/确认，设置挂坠/).closest("button")!);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
