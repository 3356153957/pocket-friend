import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type BoardDeviceId = "board-a" | "board-b";

export const MAX_PHOTO_BYTES = 512 * 1024;

export interface LatestPhoto {
  bytes: Uint8Array;
  capturedAt: string;
}

export interface LatestPhotoStoreOptions {
  directory?: string;
}

export class LatestPhotoStore {
  private readonly photos = new Map<BoardDeviceId, LatestPhoto>();
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

  async put(deviceId: BoardDeviceId, bytes: Uint8Array, capturedAtMs = Date.now()): Promise<void> {
    const photo = {
      bytes: Uint8Array.from(bytes),
      capturedAt: new Date(capturedAtMs).toISOString(),
    };
    this.photos.set(deviceId, photo);

    if (!this.directory) return;
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.photoPath(deviceId), photo.bytes);
    await writeFile(this.metadataPath(deviceId), JSON.stringify({ capturedAt: photo.capturedAt }));
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
}
