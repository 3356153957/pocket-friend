import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type BoardDeviceId = "board-a";

export const MAX_PHOTO_BYTES = 512 * 1024;

export interface LatestPhoto {
  bytes: Uint8Array;
  capturedAt: string;
  name?: string;
}

export interface ArchivedPhoto extends LatestPhoto {
  id: string;
}

export interface ArchivedPhotoSummary {
  id: string;
  capturedAt: string;
  bytes: number;
  name?: string;
}

export interface LatestPhotoStoreOptions {
  directory?: string;
}

export interface PutPhotoOptions {
  name?: string;
}

function storedName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export class LatestPhotoStore {
  private readonly photos = new Map<BoardDeviceId, LatestPhoto>();
  private readonly history = new Map<BoardDeviceId, ArchivedPhoto[]>();
  private readonly directory: string | undefined;

  constructor(options: LatestPhotoStoreOptions = {}) {
    this.directory = options.directory;
  }

  private photoPath(deviceId: BoardDeviceId): string {
    return join(this.directory ?? "", `${deviceId}.jpg`);
  }

  private metadataPath(deviceId: BoardDeviceId): string {
    return join(this.directory ?? "", `${deviceId}.json`);
  }

  private historyDirectory(deviceId: BoardDeviceId): string {
    return join(this.directory ?? "", "history", deviceId);
  }

  private historyPhotoPath(deviceId: BoardDeviceId, id: string): string {
    return join(this.historyDirectory(deviceId), id);
  }

  private historyMetadataPath(deviceId: BoardDeviceId, id: string): string {
    return join(this.historyDirectory(deviceId), `${id}.json`);
  }

  private archiveId(capturedAt: string, name?: string): string {
    const timestamp = capturedAt.replace(/[^0-9A-Za-z-]/gu, "-");
    const safeName = name
      ?.trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/gu, "-")
      .replace(/\s+/gu, "-")
      .replace(/^-+|-+$/gu, "")
      .slice(0, 80);
    return `${safeName ? `${safeName}-` : ""}${timestamp}.jpg`;
  }

  private archiveName(id: string, capturedAt: string): string | undefined {
    const suffix = this.archiveId(capturedAt);
    if (!id.endsWith(suffix)) return undefined;
    const name = id.slice(0, -suffix.length).replace(/-$/u, "");
    return storedName(name);
  }

  async put(
    deviceId: BoardDeviceId,
    bytes: Uint8Array,
    capturedAtMs = Date.now(),
    options: PutPhotoOptions = {},
  ): Promise<void> {
    const name = options.name?.trim();
    const photo = {
      bytes: Uint8Array.from(bytes),
      capturedAt: new Date(capturedAtMs).toISOString(),
      ...(name ? { name } : {}),
    };
    this.photos.set(deviceId, photo);
    const archived = {
      ...photo,
      id: this.archiveId(photo.capturedAt, photo.name),
    };
    const history = this.history.get(deviceId) ?? [];
    history.unshift(archived);
    this.history.set(deviceId, history);

    if (!this.directory) return;
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.photoPath(deviceId), photo.bytes);
    await writeFile(this.metadataPath(deviceId), JSON.stringify({
      capturedAt: photo.capturedAt,
      ...(photo.name ? { name: photo.name } : {}),
    }));
    await mkdir(this.historyDirectory(deviceId), { recursive: true });
    await writeFile(this.historyPhotoPath(deviceId, archived.id), archived.bytes);
    await writeFile(this.historyMetadataPath(deviceId, archived.id), JSON.stringify({
      capturedAt: archived.capturedAt,
      ...(archived.name ? { name: archived.name } : {}),
    }));
  }

  async get(deviceId: BoardDeviceId): Promise<LatestPhoto | undefined> {
    const photo = this.photos.get(deviceId);
    if (photo) return photo;
    if (!this.directory) return undefined;

    try {
      const [bytes, metadata] = await Promise.all([
        readFile(this.photoPath(deviceId)),
        readFile(this.metadataPath(deviceId), "utf8"),
      ]);
      const parsed = JSON.parse(metadata) as { capturedAt?: unknown; name?: unknown };
      if (typeof parsed.capturedAt !== "string") return undefined;
      const name = storedName(parsed.name);
      const stored = {
        bytes: Uint8Array.from(bytes),
        capturedAt: parsed.capturedAt,
        ...(name ? { name } : {}),
      };
      this.photos.set(deviceId, stored);
      return stored;
    } catch {
      return undefined;
    }
  }

  async listHistory(deviceId: BoardDeviceId, limit = 24): Promise<ArchivedPhotoSummary[]> {
    const cached = this.history.get(deviceId);
    const cachedPhotos = cached?.map((photo) => ({
      id: photo.id,
      capturedAt: photo.capturedAt,
      bytes: photo.bytes.byteLength,
      ...(photo.name ? { name: photo.name } : {}),
    })) ?? [];
    if (!this.directory) return cachedPhotos.slice(0, limit);

    try {
      const entries = await readdir(this.historyDirectory(deviceId));
      const photos = await Promise.all(entries
        .filter((entry) => entry.endsWith(".jpg"))
        .map(async (id): Promise<ArchivedPhotoSummary | undefined> => {
          try {
            const [bytes, metadata] = await Promise.all([
              readFile(this.historyPhotoPath(deviceId, id)),
              readFile(this.historyMetadataPath(deviceId, id), "utf8"),
            ]);
            const parsed = JSON.parse(metadata) as { capturedAt?: unknown; name?: unknown };
            if (typeof parsed.capturedAt !== "string") return undefined;
            const name = storedName(parsed.name) ?? this.archiveName(id, parsed.capturedAt);
            return {
              id,
              capturedAt: parsed.capturedAt,
              bytes: bytes.byteLength,
              ...(name ? { name } : {}),
            };
          } catch {
            return undefined;
          }
        }));
      const diskPhotos = photos
        .filter((photo): photo is ArchivedPhotoSummary => Boolean(photo))
      const byId = new Map<string, ArchivedPhotoSummary>();
      for (const photo of diskPhotos) byId.set(photo.id, photo);
      for (const photo of cachedPhotos) byId.set(photo.id, photo);
      return [...byId.values()]
        .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
        .slice(0, limit);
    } catch {
      return cachedPhotos.slice(0, limit);
    }
  }

  async getHistoryPhoto(deviceId: BoardDeviceId, id: string): Promise<ArchivedPhoto | undefined> {
    const cached = this.history.get(deviceId)?.find((photo) => photo.id === id);
    if (cached) return cached;
    if (!this.directory || !id.endsWith(".jpg") || id.includes("/") || id.includes("\\")) return undefined;

    try {
      const [bytes, metadata] = await Promise.all([
        readFile(this.historyPhotoPath(deviceId, id)),
        readFile(this.historyMetadataPath(deviceId, id), "utf8"),
      ]);
      const parsed = JSON.parse(metadata) as { capturedAt?: unknown; name?: unknown };
      if (typeof parsed.capturedAt !== "string") return undefined;
      const name = storedName(parsed.name) ?? this.archiveName(id, parsed.capturedAt);
      return {
        id,
        bytes: Uint8Array.from(bytes),
        capturedAt: parsed.capturedAt,
        ...(name ? { name } : {}),
      };
    } catch {
      return undefined;
    }
  }
}
