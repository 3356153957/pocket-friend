import type { Archetype } from "./encounterProfile.ts";

export interface ManagedPhotoSummary {
  id: string;
  name?: string;
  capturedAt?: string;
  url?: string;
}

export interface ManagedResident {
  id: string;
  name: string;
  createdAt: string;
  source: "hardware" | "demo";
}

export interface ManagedPhotoResident extends ManagedResident {
  magnetType: Archetype;
  tags: string[];
  portraitUrl?: string;
  pixelPortraitUrl: string;
  updatedAt: string;
  spriteSource: "seedream" | "local-fallback";
  seedreamModel?: string;
  activeSceneId?: string;
}

export function normalizeManagedPhotoName(rawName: string): string {
  let decoded = rawName;
  try {
    decoded = decodeURIComponent(rawName);
  } catch {
    // Keep the original name when a device sends malformed percent encoding.
  }

  return decoded
    .replace(/\.[a-z0-9]+$/iu, "")
    .replace(/-\d{4}-\d{2}-\d{2}T.*$/iu, "")
    .replace(/[_-]\d{8}[_-]\d{6}$/u, "")
    .replace(/[\s_-]*\d+$/u, "")
    .trim() || "硬件照片";
}

export function reconcileResidentsWithPhotos<T extends ManagedResident>(
  residents: T[],
  photos: ManagedPhotoSummary[],
): T[] {
  const photosByCapturedAt = new Map(
    photos.filter((photo) => photo.capturedAt).map((photo) => [photo.capturedAt, photo]),
  );
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));

  return residents.flatMap((resident) => {
    if (resident.source !== "hardware") return [];
    const photo = photosByCapturedAt.get(resident.createdAt) ?? photosById.get(resident.id);
    if (!photo) return [];
    const name = photo.name ? normalizeManagedPhotoName(photo.name) : resident.name;
    return [{ ...resident, name }];
  });
}

export function residentIdForPhoto(photo: ManagedPhotoSummary): string {
  return photo.capturedAt ?? photo.id;
}

export function createPlaceholderResidentFromPhoto(
  photo: ManagedPhotoSummary,
  index: number,
  photoUrl: string,
  sceneIds: string[],
): ManagedPhotoResident {
  const createdAt = photo.capturedAt ?? new Date().toISOString();
  const sceneId = sceneIds[index % Math.max(1, sceneIds.length)] ?? "venture-center";
  return {
    id: residentIdForPhoto(photo),
    name: normalizeManagedPhotoName(photo.name ?? photo.id),
    magnetType: "好奇选手",
    tags: ["4311照片", "正在生成像素形象"],
    portraitUrl: photoUrl,
    pixelPortraitUrl: photoUrl,
    createdAt,
    updatedAt: createdAt,
    source: "hardware",
    spriteSource: "local-fallback",
    activeSceneId: sceneId,
  };
}

export function syncPhotoResidents<T extends ManagedPhotoResident>(
  cachedResidents: T[],
  photos: ManagedPhotoSummary[],
  createPlaceholder: (photo: ManagedPhotoSummary, index: number) => T,
): T[] {
  const cachedByCapturedAt = new Map(
    cachedResidents.filter((resident) => resident.createdAt).map((resident) => [resident.createdAt, resident]),
  );
  const cachedById = new Map(cachedResidents.map((resident) => [resident.id, resident]));

  return photos.map((photo, index) => {
    const id = residentIdForPhoto(photo);
    const cached = (photo.capturedAt ? cachedByCapturedAt.get(photo.capturedAt) : undefined) ?? cachedById.get(id);
    const base = cached ?? createPlaceholder(photo, index);
    return {
      ...base,
      id,
      name: photo.name ? normalizeManagedPhotoName(photo.name) : base.name,
      createdAt: photo.capturedAt ?? base.createdAt,
    };
  });
}

export function needsPixelGeneration(resident: ManagedPhotoResident): boolean {
  return resident.pixelPortraitUrl === resident.portraitUrl || !resident.pixelPortraitUrl.startsWith("data:image/");
}
