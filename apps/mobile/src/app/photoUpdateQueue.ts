export interface PhotoWithId {
  id: string;
}

export class PhotoProcessingQueue<T extends PhotoWithId> {
  private activeId: string | null = null;
  private readonly pending: T[] = [];
  private readonly seenIds = new Set<string>();

  start(photo: T): void {
    this.activeId = photo.id;
    this.seenIds.add(photo.id);
  }

  observe(photo: T): boolean {
    if (!photo.id || this.seenIds.has(photo.id)) return false;
    this.seenIds.add(photo.id);
    this.pending.push(photo);
    return true;
  }

  observeMany(photos: T[]): number {
    return photos.reduce((count, photo) => count + Number(this.observe(photo)), 0);
  }

  markSeen(ids: Iterable<string>): void {
    for (const id of ids) {
      if (id) this.seenIds.add(id);
    }
  }

  takePending(): T | null {
    const next = this.pending.shift() ?? null;
    this.activeId = next?.id ?? null;
    return next;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get currentId(): string | null {
    return this.activeId;
  }
}

export function findPhotosAfter<T extends PhotoWithId>(
  newestFirst: T[],
  lastHandledId: string | null,
): T[] {
  if (newestFirst.length === 0) return [];
  if (!lastHandledId) return [newestFirst[0]!];

  const boundary = newestFirst.findIndex((photo) => photo.id === lastHandledId);
  if (boundary < 0) return [newestFirst[0]!];
  return newestFirst.slice(0, boundary).reverse();
}

export function shouldStartPhotoArrival(
  latestPhotoId: string,
  lastHandledId: string | null,
): boolean {
  return Boolean(latestPhotoId && latestPhotoId !== lastHandledId);
}
