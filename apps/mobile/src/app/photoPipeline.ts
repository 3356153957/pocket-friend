export interface DownloadedPhoto {
  id: string;
  capturedAt: string;
  originalUrl?: string;
  originalDataUrl: string;
  pixelPortraitUrl: string;
  source: "hardware" | "demo";
  warning?: string;
}

interface PhotoHistoryResponse {
  photos?: Array<{
    id?: string;
    capturedAt?: string;
    bytes?: number;
    url?: string;
  }>;
}

const PHOTO_API_BASE = (import.meta.env.VITE_PHOTO_API_BASE_URL as string | undefined) ?? "/photo-api";
const PHOTO_API_TOKEN = import.meta.env.VITE_PF_PHOTO_TOKEN as string | undefined;

function makePhotoApiUrl(path: string): string {
  if (PHOTO_API_BASE.startsWith("http")) {
    return `${PHOTO_API_BASE.replace(/\/$/, "")}${path}`;
  }

  return `${PHOTO_API_BASE}${path}`;
}

function authHeaders(): HeadersInit {
  if (!PHOTO_API_BASE.startsWith("http") || !PHOTO_API_TOKEN) return {};
  return { Authorization: `Bearer ${PHOTO_API_TOKEN}` };
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(makePhotoApiUrl(path), { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Photo API failed: HTTP ${response.status}`);
  }
  return await response.json() as T;
}

async function fetchImageBlob(path: string): Promise<Blob> {
  const response = await fetch(makePhotoApiUrl(path), { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Photo download failed: HTTP ${response.status}`);
  }
  return await response.blob();
}

export async function fetchLatestHardwarePhoto(): Promise<DownloadedPhoto> {
  try {
    const history = await fetchJson<PhotoHistoryResponse>("/api/photos/board-a/history");
    const latest = Array.isArray(history.photos) ? history.photos[0] : null;
    if (!latest?.id || !latest.url) {
      throw new Error("Photo API returned no board-a photos.");
    }

    const blob = await fetchImageBlob(latest.url);
    const originalDataUrl = await blobToDataUrl(blob);
    const pixelPortraitUrl = await pixelatePhotoBlob(blob, 72, 28);

    return {
      id: latest.id,
      capturedAt: latest.capturedAt ?? new Date().toISOString(),
      originalUrl: makePhotoApiUrl(latest.url),
      originalDataUrl,
      pixelPortraitUrl,
      source: "hardware",
    };
  } catch (error) {
    const fallback = await createDemoPixelPortrait();
    return {
      id: `demo-${Date.now()}`,
      capturedAt: new Date().toISOString(),
      originalDataUrl: fallback,
      pixelPortraitUrl: fallback,
      source: "demo",
      warning: error instanceof Error ? error.message : "Photo API is unavailable.",
    };
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read photo blob."));
    reader.readAsDataURL(blob);
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
    throw new Error("Failed to create pixelation canvas.");
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
  if (!ctx) throw new Error("Failed to create demo portrait canvas.");

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
