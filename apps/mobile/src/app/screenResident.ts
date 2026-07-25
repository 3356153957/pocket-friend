import type { EncounterProfile } from "./encounterProfile.ts";
import type { DownloadedPhoto } from "./photoPipeline.ts";

export interface ScreenResident {
  id: string;
  name: string;
  magnetType: EncounterProfile["archetype"];
  tags: string[];
  portraitUrl?: string;
  pixelPortraitUrl: string;
  createdAt: string;
  source: "hardware" | "demo";
  spriteSource: "seedream" | "local-fallback";
  seedreamModel?: string;
  activeSceneId?: string;
}

const FALLBACK_RESIDENT_NAME = "Hardware Photo";

export function buildScreenResident(profile: EncounterProfile, photo: DownloadedPhoto): ScreenResident {
  return {
    id: photo.id,
    name: photo.name ?? FALLBACK_RESIDENT_NAME,
    magnetType: profile.archetype,
    tags: profile.sceneTags,
    portraitUrl: photo.originalDataUrl,
    pixelPortraitUrl: photo.pixelPortraitUrl,
    createdAt: photo.capturedAt,
    source: photo.source,
    spriteSource: photo.spriteSource,
    ...(photo.seedreamModel ? { seedreamModel: photo.seedreamModel } : {}),
  };
}
