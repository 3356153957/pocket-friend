import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type BoardDeviceId = "board-a";

export const MAX_PHOTO_BYTES = 512 * 1024;

export interface LatestPhoto {
  bytes: Uint8Array;
  capturedAt: string;
}

export interface ArchivedPhoto extends LatestPhoto {
  id: string;
}

export interface ArchivedPhotoSummary {
  id: string;
  capturedAt: string;
  bytes: number;
}

export interface LatestPhotoStoreOptions {
  directory?: string;
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

  private archiveId(capturedAt: string): string {
    return `${capturedAt.replace(/[^0-9A-Za-z-]/gu, "-")}.jpg`;
  }

  async put(deviceId: BoardDeviceId, bytes: Uint8Array, capturedAtMs = Date.now()): Promise<void> {
    const photo = {
      bytes: Uint8Array.from(bytes),
      capturedAt: new Date(capturedAtMs).toISOString(),
    };
    this.photos.set(deviceId, photo);
    const archived = {
      ...photo,
      id: this.archiveId(photo.capturedAt),
    };
    const history = this.history.get(deviceId) ?? [];
    history.unshift(archived);
    this.history.set(deviceId, history);

    if (!this.directory) return;
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.photoPath(deviceId), photo.bytes);
    await writeFile(this.metadataPath(deviceId), JSON.stringify({ capturedAt: photo.capturedAt }));
    await mkdir(this.historyDirectory(deviceId), { recursive: true });
    await writeFile(this.historyPhotoPath(deviceId, archived.id), archived.bytes);
    await writeFile(this.historyMetadataPath(deviceId, archived.id), JSON.stringify({
      capturedAt: archived.capturedAt,
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
      const parsed = JSON.parse(metadata) as { capturedAt?: unknown };
      if (typeof parsed.capturedAt !== "string") return undefined;
      const stored = { bytes: Uint8Array.from(bytes), capturedAt: parsed.capturedAt };
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
            const parsed = JSON.parse(metadata) as { capturedAt?: unknown };
            if (typeof parsed.capturedAt !== "string") return undefined;
            return { id, capturedAt: parsed.capturedAt, bytes: bytes.byteLength };
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
      const parsed = JSON.parse(metadata) as { capturedAt?: unknown };
      if (typeof parsed.capturedAt !== "string") return undefined;
      return { id, bytes: Uint8Array.from(bytes), capturedAt: parsed.capturedAt };
    } catch {
      return undefined;
    }
  }
}
