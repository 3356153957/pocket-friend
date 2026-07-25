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
  needsSeedream?: boolean;
  spriteRotation?: 0 | 180;
  realPhotoRotation?: 0 | 180;
  warning?: string;
}

const PROFILE_ARCHETYPES: Archetype[] = ["安静观察者", "话痨点火机", "好奇选手", "松弛派"];

const PROFILE_TAG_GROUPS = [
  ["安静观察", "细节捕手", "慢热"],
  ["主动聊天", "气氛担当", "表达欲"],
  ["探索欲", "项目搭子", "新鲜事"],
  ["松弛感", "自然相处", "舒服节奏"],
  ["夜间灵感", "展览市集", "音乐现场"],
  ["共同任务", "手作脑洞", "协作派"],
] as const;

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicProfileForPhoto(photo: ManagedPhotoSummary, index: number): Pick<ManagedPhotoResident, "magnetType" | "tags"> {
  const seed = stableHash(`${photo.capturedAt ?? ""}|${photo.id}|${photo.name ?? ""}|${index}`);
  const magnetType = PROFILE_ARCHETYPES[seed % PROFILE_ARCHETYPES.length] ?? "好奇选手";
  const group = PROFILE_TAG_GROUPS[Math.floor(seed / PROFILE_ARCHETYPES.length) % PROFILE_TAG_GROUPS.length] ?? PROFILE_TAG_GROUPS[0];
  const accent = PROFILE_TAG_GROUPS[(index + seed) % PROFILE_TAG_GROUPS.length]?.[index % 3] ?? "pocket friend";
  return {
    magnetType,
    tags: Array.from(new Set(["4311照片", ...group.slice(0, 2), accent])),
  };
}

function hasLegacyGeneratingTag(resident: ManagedPhotoResident): boolean {
  return resident.tags.some((tag) => tag.includes("正在生成"));
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
  const profile = deterministicProfileForPhoto(photo, index);
  return {
    id: residentIdForPhoto(photo),
    name: normalizeManagedPhotoName(photo.name ?? photo.id),
    magnetType: profile.magnetType,
    tags: profile.tags,
    portraitUrl: photoUrl,
    pixelPortraitUrl: photoUrl,
    createdAt,
    updatedAt: createdAt,
    source: "hardware",
    spriteSource: "local-fallback",
    activeSceneId: sceneId,
    needsSeedream: false,
    spriteRotation: 180,
    realPhotoRotation: 180,
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
    const shouldMigrateInitialResident = Boolean(
      cached &&
      cached.spriteSource === "local-fallback" &&
      cached.needsSeedream !== true &&
      !cached.warning &&
      hasLegacyGeneratingTag(cached),
    );
    const migratedProfile = shouldMigrateInitialResident ? deterministicProfileForPhoto(photo, index) : null;
    return {
      ...base,
      ...(migratedProfile ? { magnetType: migratedProfile.magnetType, tags: migratedProfile.tags } : {}),
      id,
      name: photo.name ? normalizeManagedPhotoName(photo.name) : base.name,
      createdAt: photo.capturedAt ?? base.createdAt,
      needsSeedream: base.needsSeedream === true,
      spriteRotation: base.spriteRotation ?? (base.spriteSource === "local-fallback" ? 180 : 0),
      realPhotoRotation: base.realPhotoRotation ?? 180,
    };
  });
}

export function needsPixelGeneration(resident: ManagedPhotoResident): boolean {
  if (resident.spriteSource === "seedream") return false;
  if (resident.warning) return false;
  return resident.needsSeedream === true;
}
