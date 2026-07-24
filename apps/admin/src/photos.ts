export type BoardDeviceId = "board-a" | "board-b";

export const MAX_PHOTO_BYTES = 64 * 1024;

export interface LatestPhoto {
  bytes: Uint8Array;
  capturedAt: string;
}

export class LatestPhotoStore {
  private readonly photos = new Map<BoardDeviceId, LatestPhoto>();

  put(deviceId: BoardDeviceId, bytes: Uint8Array, capturedAtMs = Date.now()): void {
    this.photos.set(deviceId, {
      bytes: Uint8Array.from(bytes),
      capturedAt: new Date(capturedAtMs).toISOString(),
    });
  }

  get(deviceId: BoardDeviceId): LatestPhoto | undefined {
    return this.photos.get(deviceId);
  }
}
