const AVATAR_GENERATION_ENDPOINT = defaultAvatarGenerationEndpoint();
const SEEDREAM_TIMEOUT_MS = 60000;
const WHITE_THRESHOLD = 242;
const CROP_PADDING = 18;

interface SeedreamGenerationResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  error?: {
    message?: string;
    code?: string;
  };
  model?: string;
}

export interface SeedreamGenerationResult {
  imageUrl: string;
  rawImageUrl: string;
  compressedReferenceDataUrl: string;
  model: string;
}

export async function generateSeedreamPixelAvatar(referenceDataUrl: string): Promise<SeedreamGenerationResult> {
  const response = await fetchSeedreamWithTimeout({
    image: referenceDataUrl,
  });
  const payload = await response.json().catch(() => null) as SeedreamGenerationResponse | null;

  if (!response.ok) {
    throw new Error(`像素形象生成失败，状态码 ${response.status}。`);
  }

  const rawImageUrl = payload?.data?.[0]?.url ?? payload?.data?.[0]?.b64_json;
  if (!rawImageUrl) {
    throw new Error("形象生成服务没有返回图片。");
  }

  const resolvedRawImageUrl = rawImageUrl.startsWith("http") ? rawImageUrl : `data:image/png;base64,${rawImageUrl}`;
  const spriteUrl = await isolateSpriteFromWhiteCanvas(resolvedRawImageUrl);

  return {
    imageUrl: spriteUrl,
    rawImageUrl: resolvedRawImageUrl,
    compressedReferenceDataUrl: referenceDataUrl,
    model: payload?.model ?? "seedream",
  };
}

async function fetchSeedreamWithTimeout(body: Record<string, unknown>): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SEEDREAM_TIMEOUT_MS);

  try {
    return await fetch(AVATAR_GENERATION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("像素形象生成超时。");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function defaultAvatarGenerationEndpoint(): string {
  if (typeof window === "undefined") return "/avatar-api/generate";
  const { hostname, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return "/avatar-api/generate";
  return `${protocol}//${hostname}:4311/island-avatar-api/generate`;
}

async function isolateSpriteFromWhiteCanvas(imageUrl: string): Promise<string> {
  const image = await loadSeedreamImage(imageUrl);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.naturalWidth || image.width;
  sourceCanvas.height = image.naturalHeight || image.height;
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) {
    throw new Error("无法创建像素形象画布。");
  }

  sourceCtx.imageSmoothingEnabled = false;
  sourceCtx.drawImage(image, 0, 0);
  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const bounds = transparentizeWhiteBackground(imageData);

  if (!bounds) {
    return imageUrl;
  }

  sourceCtx.putImageData(imageData, 0, 0);

  const cropX = Math.max(0, bounds.minX - CROP_PADDING);
  const cropY = Math.max(0, bounds.minY - CROP_PADDING);
  const cropRight = Math.min(sourceCanvas.width, bounds.maxX + CROP_PADDING + 1);
  const cropBottom = Math.min(sourceCanvas.height, bounds.maxY + CROP_PADDING + 1);
  const cropWidth = Math.max(1, cropRight - cropX);
  const cropHeight = Math.max(1, cropBottom - cropY);

  const spriteCanvas = document.createElement("canvas");
  spriteCanvas.width = cropWidth;
  spriteCanvas.height = cropHeight;
  const spriteCtx = spriteCanvas.getContext("2d");
  if (!spriteCtx) {
    throw new Error("无法创建裁剪后的像素形象画布。");
  }

  spriteCtx.imageSmoothingEnabled = false;
  spriteCtx.drawImage(sourceCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return spriteCanvas.toDataURL("image/png");
}

function transparentizeWhiteBackground(imageData: ImageData): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = imageData.width;
  let minY = imageData.height;
  let maxX = -1;
  let maxY = -1;
  const { data, width, height } = imageData;
  const transparentBackground = findConnectedWhiteBackground(data, width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3] ?? 255;
      const shouldTransparentize = transparentBackground[y * width + x] === 1 || alpha < 8;

      if (shouldTransparentize) {
        data[index + 3] = 0;
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function findConnectedWhiteBackground(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const background = new Uint8Array(width * height);
  const stack: number[] = [];

  const pushIfWhite = (x: number, y: number) => {
    const pixel = y * width + x;
    if (background[pixel] === 1 || !isWhitePixel(data, pixel * 4)) return;
    background[pixel] = 1;
    stack.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    pushIfWhite(x, 0);
    pushIfWhite(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    pushIfWhite(0, y);
    pushIfWhite(width - 1, y);
  }

  while (stack.length > 0) {
    const pixel = stack.pop();
    if (pixel === undefined) break;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) pushIfWhite(x - 1, y);
    if (x < width - 1) pushIfWhite(x + 1, y);
    if (y > 0) pushIfWhite(x, y - 1);
    if (y < height - 1) pushIfWhite(x, y + 1);
  }

  return background;
}

function isWhitePixel(data: Uint8ClampedArray, index: number): boolean {
  const red = data[index] ?? 255;
  const green = data[index + 1] ?? 255;
  const blue = data[index + 2] ?? 255;
  const alpha = data[index + 3] ?? 255;
  return alpha < 8 || (red >= WHITE_THRESHOLD && green >= WHITE_THRESHOLD && blue >= WHITE_THRESHOLD);
}

async function loadSeedreamImage(imageUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.src = imageUrl;

  await image.decode();
  return image;
}
