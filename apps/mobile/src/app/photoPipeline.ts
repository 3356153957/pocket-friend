import { generateSeedreamPixelAvatar } from "./seedreamAvatar.ts";
import { normalizeManagedPhotoName } from "./photoResidentSync.ts";

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

export interface HardwarePhotoProgress {
  stage: "potato-ready";
  photo: DownloadedPhoto;
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

const PHOTO_API_BASE = (import.meta.env.VITE_PHOTO_API_BASE_URL as string | undefined) ?? defaultPhotoApiBase();
const DEMO_PHOTO_NAME = (import.meta.env.VITE_DEMO_PHOTO_NAME as string | undefined)?.trim();
const HISTORY_TIMEOUT_MS = 5000;
const PHOTO_DOWNLOAD_TIMEOUT_MS = 6000;
const PHOTO_NORMALIZE_TIMEOUT_MS = 5000;
const PIXELATE_TIMEOUT_MS = 6000;

export function makePhotoApiUrl(path: string): string {
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
      id: photo.capturedAt ?? photo.id,
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
  onProgress?: (progress: HardwarePhotoProgress) => void,
): Promise<DownloadedPhoto> {
    const blob = await fetchImageBlob(candidate.url);
    const normalized = await withTimeout(normalizePhotoBlob(blob, 1024, 180), PHOTO_NORMALIZE_TIMEOUT_MS, "照片方向校正超时。");
    const basePhoto = {
      id: candidate.id,
      name: normalizeManagedPhotoName(candidate.name ?? candidate.id),
      capturedAt: candidate.capturedAt ?? new Date().toISOString(),
      originalUrl: makePhotoApiUrl(candidate.url),
      originalDataUrl: normalized.dataUrl,
      source: "hardware" as const,
    };
    const potatoUrl = await withTimeout(createAbstractPotato(normalized.dataUrl), PIXELATE_TIMEOUT_MS, "本地 POTATO 像素小人处理超时。");
    onProgress?.({
      stage: "potato-ready",
      photo: {
        ...basePhoto,
        pixelPortraitUrl: potatoUrl,
        spriteSource: "local-fallback",
      },
    });

    let pixelPortraitUrl: string;
    let spriteSource: DownloadedPhoto["spriteSource"] = "seedream";
    let seedreamModel: string | undefined;
    let warning: string | undefined;

    try {
      const seedream = await generateSeedreamPixelAvatar(normalized.dataUrl);
      pixelPortraitUrl = seedream.imageUrl;
      seedreamModel = seedream.model;
    } catch (error) {
      pixelPortraitUrl = normalized.dataUrl;
      spriteSource = "local-fallback";
      warning = `Seedream 像素小人生成失败，已使用真人照片兜底：${errorMessage(error)}`;
    }

    return {
      ...basePhoto,
      pixelPortraitUrl,
      spriteSource,
      ...(seedreamModel ? { seedreamModel } : {}),
      ...(warning ? { warning } : {}),
    };
}

function defaultPhotoApiBase(): string {
  return "/photo-api";
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

function selectHardwarePhoto<T extends { id?: string; name?: string }>(photos: T[]): T | null {
  if (!DEMO_PHOTO_NAME) return photos[0] ?? null;

  const normalizedTarget = DEMO_PHOTO_NAME.toLocaleLowerCase();
  return photos.find((photo) => {
    const displayName = normalizeManagedPhotoName(photo.name ?? photo.id ?? "").toLocaleLowerCase();
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

async function createAbstractPotato(refUrl: string): Promise<string> {
  const image = await loadImage(refUrl);
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = 48;
  sampleCanvas.height = 48;
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!sampleCtx) throw new Error("无法生成 POTATO 像素小人。");
  sampleCtx.drawImage(image, 0, 0, 48, 48);
  const palette = extractPalette(sampleCtx.getImageData(0, 0, 48, 48).data);

  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法生成 POTATO 像素小人。");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 320, 320);
  drawPixelPotato(ctx, palette);
  return canvas.toDataURL("image/png");
}

function drawPixelPotato(ctx: CanvasRenderingContext2D, palette: string[]): void {
  const skin = palette[0] ?? "#e5b98f";
  const shadow = palette[1] ?? "#9b6b4a";
  const hair = palette[2] ?? "#34221f";
  const blush = "#ff7aa8";
  const outline = "#182336";
  const px = 10;
  const fill = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * px, y * px, w * px, h * px);
  };

  fill(11, 4, 10, 2, outline);
  fill(8, 6, 16, 2, outline);
  fill(6, 8, 20, 14, outline);
  fill(8, 22, 16, 3, outline);
  fill(10, 25, 12, 2, outline);
  fill(9, 7, 14, 2, hair);
  fill(7, 9, 18, 4, hair);
  fill(8, 13, 16, 9, skin);
  fill(9, 22, 14, 2, skin);
  fill(11, 24, 10, 1, skin);
  fill(9, 15, 3, 2, "#ffffff");
  fill(20, 15, 3, 2, "#ffffff");
  fill(10, 16, 2, 2, outline);
  fill(21, 16, 2, 2, outline);
  fill(12, 19, 8, 1, outline);
  fill(8, 19, 3, 2, blush);
  fill(21, 19, 3, 2, blush);
  fill(7, 22, 2, 2, shadow);
  fill(23, 14, 2, 7, shadow);
  fill(11, 26, 4, 2, "#45c9ff");
  fill(17, 26, 4, 2, "#45c9ff");
  fill(9, 28, 6, 1, outline);
  fill(17, 28, 6, 1, outline);
  fill(4, 10, 2, 5, "#b7f64a");
  fill(26, 10, 2, 5, "#ff4eaa");
  fill(5, 15, 2, 2, outline);
  fill(25, 15, 2, 2, outline);
}

function extractPalette(data: Uint8ClampedArray): string[] {
  let skin = [0, 0, 0, 0];
  let dark = [0, 0, 0, 0];
  let vivid = [0, 0, 0, 0];

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index] ?? 0;
    const green = data[index + 1] ?? 0;
    const blue = data[index + 2] ?? 0;
    const alpha = data[index + 3] ?? 255;
    if (alpha < 16) continue;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const saturation = max - min;
    const light = (max + min) / 2;

    if (red > 120 && green > 70 && blue > 45 && red >= blue && light > 80) {
      skin = addColor(skin, red, green, blue);
    }
    if (light < 95) dark = addColor(dark, red, green, blue);
    if (saturation > 45 && light > 55) vivid = addColor(vivid, red, green, blue);
  }

  return [
    toHex(average(skin, [226, 185, 144])),
    toHex(average(dark, [118, 78, 55])),
    toHex(average((vivid[3] ?? 0) > 0 ? vivid : dark, [55, 35, 31])),
  ];
}

function addColor(total: number[], red: number, green: number, blue: number): number[] {
  total[0] = (total[0] ?? 0) + red;
  total[1] = (total[1] ?? 0) + green;
  total[2] = (total[2] ?? 0) + blue;
  total[3] = (total[3] ?? 0) + 1;
  return total;
}

function average(total: number[], fallback: number[]): number[] {
  const count = total[3] ?? 0;
  if (count <= 0) return fallback;
  return [
    Math.round((total[0] ?? 0) / count),
    Math.round((total[1] ?? 0) / count),
    Math.round((total[2] ?? 0) / count),
  ];
}

function toHex(rgb: number[]): string {
  return `#${rgb.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0")).join("")}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("照片预览加载失败。"));
    image.src = src;
  });
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
