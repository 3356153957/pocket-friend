import { generateSeedreamPixelAvatar } from "./seedreamAvatar.ts";

export interface DownloadedPhoto {
  id: string;
  name?: string;
  capturedAt: string;
  originalUrl?: string;
  originalDataUrl: string;
  pixelPortraitUrl: string;
  source: "hardware" | "demo";
  spriteSource: "seedream" | "local-fallback";
  seedreamModel?: string;
  warning?: string;
}

export interface HardwarePhotoCandidate {
  id: string;
  name?: string;
  capturedAt?: string;
  url: string;
}

interface PhotoHistoryResponse {
  photos?: Array<{
    id?: string;
    name?: string;
    capturedAt?: string;
    bytes?: number;
    url?: string;
  }>;
}

const PHOTO_API_BASE = (import.meta.env.VITE_PHOTO_API_BASE_URL as string | undefined) ?? "/photo-api";
const DEMO_PHOTO_NAME = (import.meta.env.VITE_DEMO_PHOTO_NAME as string | undefined)?.trim();
const HISTORY_TIMEOUT_MS = 5000;
const PHOTO_DOWNLOAD_TIMEOUT_MS = 6000;
const PHOTO_NORMALIZE_TIMEOUT_MS = 5000;
const PIXELATE_TIMEOUT_MS = 6000;

function makePhotoApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    if (PHOTO_API_BASE.startsWith("http")) return path;
    const url = new URL(path);
    return `${PHOTO_API_BASE}${url.pathname}${url.search}`;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (PHOTO_API_BASE.startsWith("http")) {
    return `${PHOTO_API_BASE.replace(/\/$/, "")}${normalizedPath}`;
  }

  return `${PHOTO_API_BASE}${normalizedPath}`;
}

async function fetchJson<T>(path: string, timeoutMs = HISTORY_TIMEOUT_MS): Promise<T> {
  const response = await fetchWithTimeout(makePhotoApiUrl(path), {}, timeoutMs, "照片历史记录请求超时。");
  if (!response.ok) {
    throw new Error(`照片服务请求失败，状态码 ${response.status}。`);
  }
  return await response.json() as T;
}

async function fetchImageBlob(path: string, timeoutMs = PHOTO_DOWNLOAD_TIMEOUT_MS): Promise<Blob> {
  const response = await fetchWithTimeout(makePhotoApiUrl(path), {}, timeoutMs, "照片下载超时。");
  if (!response.ok) {
    throw new Error(`照片下载失败，状态码 ${response.status}。`);
  }
  return await response.blob();
}

export async function fetchLatestHardwarePhoto(): Promise<DownloadedPhoto> {
  try {
    const latest = await fetchLatestHardwarePhotoCandidate();
    return await processHardwarePhotoCandidate(latest);
  } catch (error) {
    return await createDemoDownloadedPhoto(errorMessage(error));
  }
}

export async function fetchHardwarePhotoCandidates(): Promise<HardwarePhotoCandidate[]> {
  const history = await fetchJson<PhotoHistoryResponse>("/api/photos/board-a/history");
  const candidates = (Array.isArray(history.photos) ? history.photos : [])
    .filter((photo): photo is HardwarePhotoCandidate => Boolean(photo.id && photo.url))
    .map((photo) => ({
      id: photo.id,
      url: photo.url,
      ...(photo.name ? { name: photo.name } : {}),
      ...(photo.capturedAt ? { capturedAt: photo.capturedAt } : {}),
    }));

  if (!DEMO_PHOTO_NAME) return candidates;
  const selected = selectHardwarePhoto(candidates);
  return selected ? [selected] : [];
}

export async function fetchLatestHardwarePhotoCandidate(): Promise<HardwarePhotoCandidate> {
  const latest = (await fetchHardwarePhotoCandidates())[0];
  if (!latest) throw new Error("照片服务中没有找到硬件照片。");
  return latest;
}

export async function processHardwarePhotoCandidate(
  candidate: HardwarePhotoCandidate,
): Promise<DownloadedPhoto> {
    const blob = await fetchImageBlob(candidate.url);
    const normalized = await withTimeout(normalizePhotoBlob(blob, 1024, 180), PHOTO_NORMALIZE_TIMEOUT_MS, "照片方向校正超时。");
    let pixelPortraitUrl: string;
    let spriteSource: DownloadedPhoto["spriteSource"] = "seedream";
    let seedreamModel: string | undefined;
    let warning: string | undefined;

    try {
      const seedream = await generateSeedreamPixelAvatar(normalized.dataUrl);
      pixelPortraitUrl = seedream.imageUrl;
      seedreamModel = seedream.model;
    } catch (error) {
      pixelPortraitUrl = await withTimeout(pixelatePhotoBlob(normalized.blob, 72, 28), PIXELATE_TIMEOUT_MS, "本地备用像素化处理超时。");
      spriteSource = "local-fallback";
      warning = `智能形象生成失败，已使用本地像素备用方案：${errorMessage(error)}`;
    }

    return {
      id: candidate.id,
      name: extractDisplayName(candidate.name ?? candidate.id),
      capturedAt: candidate.capturedAt ?? new Date().toISOString(),
      originalUrl: makePhotoApiUrl(candidate.url),
      originalDataUrl: normalized.dataUrl,
      pixelPortraitUrl,
      source: spriteSource === "seedream" ? "hardware" : "demo",
      spriteSource,
      ...(seedreamModel ? { seedreamModel } : {}),
      ...(warning ? { warning } : {}),
    };
}

export async function createDemoDownloadedPhoto(warning = "照片服务暂时不可用。"): Promise<DownloadedPhoto> {
  const fallback = await createDemoPixelPortrait();
  return {
    id: `demo-${Date.now()}`,
    name: "等待中",
    capturedAt: new Date().toISOString(),
    originalDataUrl: fallback,
    pixelPortraitUrl: fallback,
    source: "demo",
    spriteSource: "local-fallback",
    warning,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, timeoutMessage: string): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function extractDisplayName(rawName: string): string {
  const decoded = decodeURIComponent(rawName);
  const withoutExtension = decoded.replace(/\.[a-z0-9]+$/i, "");
  const withoutTimestamp = withoutExtension.replace(/-\d{4}-\d{2}-\d{2}T.*$/i, "");
  const beforeCounter = withoutTimestamp.split("_")[0]?.trim();
  return beforeCounter || withoutTimestamp || "硬件照片";
}

function selectHardwarePhoto<T extends { id?: string; name?: string }>(photos: T[]): T | null {
  if (!DEMO_PHOTO_NAME) return photos[0] ?? null;

  const normalizedTarget = DEMO_PHOTO_NAME.toLocaleLowerCase();
  return photos.find((photo) => {
    const displayName = extractDisplayName(photo.name ?? photo.id ?? "").toLocaleLowerCase();
    return displayName === normalizedTarget;
  }) ?? photos[0] ?? null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "照片服务暂时不可用。";
}

async function normalizePhotoBlob(blob: Blob, maxSide: number, rotateDegrees: 0 | 90 | 180 | 270): Promise<{ blob: Blob; dataUrl: string }> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  const rotated = rotateDegrees === 90 || rotateDegrees === 270;
  canvas.width = rotated ? height : width;
  canvas.height = rotated ? width : height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("无法创建照片方向校正画布。");
  }

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotateDegrees * Math.PI) / 180);
  ctx.drawImage(bitmap, -width / 2, -height / 2, width, height);
  bitmap.close();

  const normalizedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("无法导出校正后的照片。"));
    }, "image/jpeg", 0.9);
  });

  return {
    blob: normalizedBlob,
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
  };
}

async function pixelatePhotoBlob(blob: Blob, size: number, colorCount: number): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.max(0, Math.floor((bitmap.width - side) / 2));
  const sy = Math.max(0, Math.floor((bitmap.height - side) / 2));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error("无法创建像素化画布。");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, size, size);
  const palette = buildMedianPalette(imageData.data, colorCount);
  applyPalette(imageData.data, palette);
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}

interface ColorBox {
  colors: number[][];
}

function buildMedianPalette(data: Uint8ClampedArray, colorCount: number): number[][] {
  const colors: number[][] = [];
  for (let index = 0; index < data.length; index += 4) {
    colors.push([data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0]);
  }

  const boxes: ColorBox[] = [{ colors }];
  while (boxes.length < colorCount) {
    boxes.sort((a, b) => colorRange(b.colors) - colorRange(a.colors));
    const box = boxes.shift();
    if (!box || box.colors.length <= 1) break;
    const channel = widestChannel(box.colors);
    box.colors.sort((a, b) => (a[channel] ?? 0) - (b[channel] ?? 0));
    const middle = Math.max(1, Math.floor(box.colors.length / 2));
    boxes.push({ colors: box.colors.slice(0, middle) }, { colors: box.colors.slice(middle) });
  }

  return boxes.map((box) => averageColor(box.colors));
}

function colorRange(colors: number[][]): number {
  const ranges = [0, 1, 2].map((channel) => {
    const values = colors.map((color) => color[channel] ?? 0);
    return Math.max(...values) - Math.min(...values);
  });
  return Math.max(...ranges);
}

function widestChannel(colors: number[][]): 0 | 1 | 2 {
  const ranges = [0, 1, 2].map((channel) => {
    const values = colors.map((color) => color[channel] ?? 0);
    return Math.max(...values) - Math.min(...values);
  });
  const widest = ranges.indexOf(Math.max(...ranges));
  return widest as 0 | 1 | 2;
}

function averageColor(colors: number[][]): number[] {
  const sum = colors.reduce((total, color) => {
    total[0] = (total[0] ?? 0) + (color[0] ?? 0);
    total[1] = (total[1] ?? 0) + (color[1] ?? 0);
    total[2] = (total[2] ?? 0) + (color[2] ?? 0);
    return total;
  }, [0, 0, 0]);

  return sum.map((value) => Math.round(value / Math.max(1, colors.length)));
}

function applyPalette(data: Uint8ClampedArray, palette: number[][]) {
  for (let index = 0; index < data.length; index += 4) {
    const nearest = nearestColor([data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0], palette);
    data[index] = nearest[0] ?? 0;
    data[index + 1] = nearest[1] ?? 0;
    data[index + 2] = nearest[2] ?? 0;
    data[index + 3] = 255;
  }
}

function nearestColor(color: number[], palette: number[][]): number[] {
  const first = palette[0];
  if (!first) return [0, 0, 0];

  return palette.reduce((best, candidate) => {
    const bestDistance = colorDistance(color, best);
    const candidateDistance = colorDistance(color, candidate);
    return candidateDistance < bestDistance ? candidate : best;
  }, first);
}

function colorDistance(a: number[], b: number[]): number {
  return (((a[0] ?? 0) - (b[0] ?? 0)) ** 2)
    + (((a[1] ?? 0) - (b[1] ?? 0)) ** 2)
    + (((a[2] ?? 0) - (b[2] ?? 0)) ** 2);
}

async function createDemoPixelPortrait(): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 72;
  canvas.height = 72;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建演示形象画布。");

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#D5F5E8";
  ctx.fillRect(0, 0, 72, 72);
  ctx.fillStyle = "#182336";
  ctx.fillRect(18, 12, 36, 40);
  ctx.fillStyle = "#F5CBA7";
  ctx.fillRect(16, 18, 40, 34);
  ctx.fillStyle = "#5D4037";
  ctx.fillRect(12, 8, 48, 18);
  ctx.fillRect(10, 20, 8, 24);
  ctx.fillRect(54, 20, 8, 24);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(24, 32, 8, 8);
  ctx.fillRect(40, 32, 8, 8);
  ctx.fillStyle = "#182336";
  ctx.fillRect(28, 34, 4, 4);
  ctx.fillRect(44, 34, 4, 4);
  ctx.fillStyle = "#F04AA5";
  ctx.fillRect(32, 46, 8, 3);
  ctx.fillStyle = "#22C7F2";
  ctx.fillRect(20, 54, 32, 14);

  return canvas.toDataURL("image/png");
}
