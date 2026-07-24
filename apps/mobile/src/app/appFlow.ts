export type OnboardingStep = "welcome" | "quiz" | "pendant";
export type AppTab = "map" | "pals" | "settings";

export interface Prefs {
  vibe?: string;
  interests: string[];
  meetStyle?: string;
  buzz?: string;
  radius: number;
  quiet: boolean;
}

export function createInitialPrefs(): Prefs {
  return {
    interests: [],
    radius: 300,
    quiet: false,
  };
}

export function canContinueQuiz(prefs: Prefs): boolean {
  return Boolean(
    prefs.vibe
      && prefs.interests.length >= 3
      && prefs.meetStyle,
  );
}

export function toggleInterest(
  currentInterests: string[],
  interest: string,
): string[] {
  return currentInterests.includes(interest)
    ? currentInterests.filter((candidate) => candidate !== interest)
    : [...currentInterests, interest];
}
