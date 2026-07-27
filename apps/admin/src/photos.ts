import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
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
  /** Days to keep archived history photos. Unset keeps photos indefinitely. */
  retentionDays?: number;
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
  private readonly retentionMs: number | undefined;

  constructor(options: LatestPhotoStoreOptions = {}) {
    this.directory = options.directory;
    this.retentionMs = options.retentionDays && options.retentionDays > 0
      ? options.retentionDays * 24 * 60 * 60 * 1000
      : undefined;
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
    await this.pruneExpired(deviceId, capturedAtMs);
  }

  /** Removes archived photos older than the configured retention window. */
  async pruneExpired(deviceId: BoardDeviceId, nowMs = Date.now()): Promise<void> {
    if (!this.retentionMs) return;
    const cutoff = nowMs - this.retentionMs;
    const expired = (capturedAt: string): boolean => {
      const parsed = Date.parse(capturedAt);
      return Number.isFinite(parsed) && parsed < cutoff;
    };

    const cached = this.history.get(deviceId);
    if (cached) {
      this.history.set(deviceId, cached.filter((photo) => !expired(photo.capturedAt)));
    }

    if (!this.directory) return;
    let entries: string[];
    try {
      entries = await readdir(this.historyDirectory(deviceId));
    } catch {
      return;
    }
    await Promise.all(entries
      .filter((entry) => entry.endsWith(".jpg"))
      .map(async (id) => {
        try {
          const metadata = await readFile(this.historyMetadataPath(deviceId, id), "utf8");
          const parsed = JSON.parse(metadata) as { capturedAt?: unknown };
          if (typeof parsed.capturedAt !== "string" || !expired(parsed.capturedAt)) return;
          await Promise.all([
            rm(this.historyPhotoPath(deviceId, id), { force: true }),
            rm(this.historyMetadataPath(deviceId, id), { force: true }),
          ]);
        } catch {
          // Ignore unreadable entries; they are skipped by listHistory as well.
        }
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

  async deleteHistoryPhoto(deviceId: BoardDeviceId, id: string): Promise<boolean> {
    if (!id.endsWith(".jpg") || id.includes("/") || id.includes("\\")) return false;
    const photo = await this.getHistoryPhoto(deviceId, id);
    if (!photo) return false;

    const cached = this.history.get(deviceId);
    if (cached) {
      this.history.set(deviceId, cached.filter((item) => item.id !== id));
    }

    const latest = await this.get(deviceId);
    if (latest?.capturedAt === photo.capturedAt) {
      this.photos.delete(deviceId);
      if (this.directory) {
        await Promise.all([
          rm(this.photoPath(deviceId), { force: true }),
          rm(this.metadataPath(deviceId), { force: true }),
        ]);
      }
    }

    if (this.directory) {
      await Promise.all([
        rm(this.historyPhotoPath(deviceId, id), { force: true }),
        rm(this.historyMetadataPath(deviceId, id), { force: true }),
      ]);
    }
    return true;
  }

  async renameHistoryPhoto(deviceId: BoardDeviceId, id: string, name: string): Promise<ArchivedPhotoSummary | undefined> {
    const normalizedName = storedName(name);
    if (!normalizedName || !id.endsWith(".jpg") || id.includes("/") || id.includes("\\")) return undefined;
    const photo = await this.getHistoryPhoto(deviceId, id);
    if (!photo) return undefined;

    const nextId = this.archiveId(photo.capturedAt, normalizedName);
    const renamed = { ...photo, id: nextId, name: normalizedName };
    const cached = this.history.get(deviceId);
    if (cached) {
      this.history.set(deviceId, cached.map((item) => item.id === id ? renamed : item));
    }

    const latest = await this.get(deviceId);
    if (latest?.capturedAt === photo.capturedAt) {
      this.photos.set(deviceId, { ...latest, name: normalizedName });
      if (this.directory) {
        await writeFile(this.metadataPath(deviceId), JSON.stringify({
          capturedAt: latest.capturedAt,
          name: normalizedName,
        }));
      }
    }

    if (this.directory) {
      if (nextId !== id) {
        await Promise.all([
          rename(this.historyPhotoPath(deviceId, id), this.historyPhotoPath(deviceId, nextId)),
          rename(this.historyMetadataPath(deviceId, id), this.historyMetadataPath(deviceId, nextId)),
        ]);
      }
      await writeFile(this.historyMetadataPath(deviceId, nextId), JSON.stringify({
        capturedAt: photo.capturedAt,
        name: normalizedName,
      }));
    }
    return {
      id: nextId,
      capturedAt: photo.capturedAt,
      bytes: photo.bytes.byteLength,
      name: normalizedName,
    };
  }
}
