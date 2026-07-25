export interface ManagedPhotoSummary {
  id: string;
  name?: string;
  capturedAt?: string;
}

export interface ManagedResident {
  id: string;
  name: string;
  createdAt: string;
  source: "hardware" | "demo";
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
