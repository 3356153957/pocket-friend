import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface PhotoDownloadTokenRecord {
  digest: string;
  createdAt: string;
}

export interface PhotoDownloadTokenStoreOptions {
  file?: string;
}

export interface GeneratedPhotoDownloadToken {
  token: string;
  createdAt: string;
}

function digestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftDigest = Buffer.from(left, "hex");
  const rightDigest = Buffer.from(right, "hex");
  if (leftDigest.byteLength !== rightDigest.byteLength) return false;
  return timingSafeEqual(leftDigest, rightDigest);
}

export class PhotoDownloadTokenStore {
  private readonly file: string | undefined;
  private record: PhotoDownloadTokenRecord | undefined;

  constructor(options: PhotoDownloadTokenStoreOptions = {}) {
    this.file = options.file;
  }

  async generate(nowMs = Date.now()): Promise<GeneratedPhotoDownloadToken> {
    const token = randomBytes(32).toString("hex");
    const record = {
      digest: digestToken(token),
      createdAt: new Date(nowMs).toISOString(),
    };
    this.record = record;

    if (this.file) {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(this.file, JSON.stringify(record));
    }

    return { token, createdAt: record.createdAt };
  }

  async verify(token: string): Promise<boolean> {
    const record = await this.getRecord();
    if (!record || !token) return false;
    return constantTimeEqual(digestToken(token), record.digest);
  }

  private async getRecord(): Promise<PhotoDownloadTokenRecord | undefined> {
    if (this.record) return this.record;
    if (!this.file) return undefined;

    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8")) as Partial<PhotoDownloadTokenRecord>;
      if (typeof parsed.digest !== "string" || typeof parsed.createdAt !== "string") return undefined;
      this.record = { digest: parsed.digest, createdAt: parsed.createdAt };
      return this.record;
    } catch {
      return undefined;
    }
  }
}
