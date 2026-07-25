import type { ScreenResident } from "./screenResident.ts";

export function residentsForScene(
  sceneId: string,
  residents: ScreenResident[],
): ScreenResident[] {
  return residents.filter((resident) => resident.activeSceneId === sceneId);
}
