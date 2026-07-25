const DOUBAO_ENDPOINT = (import.meta.env.VITE_DOUBAO_ENDPOINT as string | undefined)
  ?? "/seedream-api/api/v3/images/generations";
const DEFAULT_DOUBAO_MODEL = "doubao-seedream-5-0-260128";
const SEEDREAM_TIMEOUT_MS = 60000;
const WHITE_THRESHOLD = 242;
const CROP_PADDING = 18;

export const SEEDREAM_MAPLESTORY_PROMPT =
  "A MapleStory-style 2D pixel art game character sprite, 2.0-2.3 head-to-body ratio, 35-45 degree quarter view, big wide-set eyes with large pupils and highlight, no nose, very small mouth, soft blush, oversized hairstyle with highlight on top, no neck, head connects directly to torso, very small torso with short cylindrical arms and legs, 32-64px retro game sprite scaled up, chunky visible pixels, clean 1px outline, flat cel-shaded colors, solid color pixel blocks, minimal shading, no dithering, no smooth gradients, no airbrush, no anti-aliasing, pure white background, single character only, full body, centered, 1080x1080 canvas. Character should look exactly like a real MapleStory player character sprite, not regular pixel art. Preserve hair color, skin tone, and facial features from the reference photo.";

interface SeedreamGenerationResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
  error?: {
    message?: string;
    code?: string;
  };
}

export interface SeedreamGenerationResult {
  imageUrl: string;
  rawImageUrl: string;
  compressedReferenceDataUrl: string;
  model: string;
}

export async function generateSeedreamPixelAvatar(referenceDataUrl: string): Promise<SeedreamGenerationResult> {
  const apiKey = import.meta.env.VITE_DOUBAO_API_KEY as string | undefined;
  const model = (import.meta.env.VITE_DOUBAO_MODEL as string | undefined) ?? DEFAULT_DOUBAO_MODEL;

  if (DOUBAO_ENDPOINT.startsWith("http") && !apiKey) {
    throw new Error("Missing VITE_DOUBAO_API_KEY. Please check the project root .env file.");
  }

  const response = await fetchSeedreamWithTimeout({
    model,
    prompt: SEEDREAM_MAPLESTORY_PROMPT,
    image: referenceDataUrl,
    sequential_image_generation: "disabled",
    size: "2K",
    response_format: "url",
    stream: false,
    watermark: false,
  });
  const payload = await response.json().catch(() => null) as SeedreamGenerationResponse | null;

  if (!response.ok) {
    if (payload?.error?.code === "ModelNotOpen") {
      throw new Error(`API Key is valid, but model ${model} is not activated for this account.`);
    }

    if (payload?.error?.code === "InvalidEndpointOrModel.NotFound") {
      throw new Error(`Ark cannot find model/endpoint ${model}.`);
    }

    throw new Error(payload?.error?.message ?? `Seedream generation failed with ${model}: HTTP ${response.status}`);
  }

  const rawImageUrl = payload?.data?.[0]?.url ?? payload?.data?.[0]?.b64_json;
  if (!rawImageUrl) {
    throw new Error(`Seedream returned no image URL for model ${model}.`);
  }

  const resolvedRawImageUrl = rawImageUrl.startsWith("http") ? rawImageUrl : `data:image/png;base64,${rawImageUrl}`;
  const spriteUrl = await isolateSpriteFromWhiteCanvas(resolvedRawImageUrl);

  return {
    imageUrl: spriteUrl,
    rawImageUrl: resolvedRawImageUrl,
    compressedReferenceDataUrl: referenceDataUrl,
    model,
  };
}

async function fetchSeedreamWithTimeout(body: Record<string, unknown>): Promise<Response> {
  const apiKey = import.meta.env.VITE_DOUBAO_API_KEY as string | undefined;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SEEDREAM_TIMEOUT_MS);

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (DOUBAO_ENDPOINT.startsWith("http") && apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    return await fetch(DOUBAO_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Seedream generation timed out.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function isolateSpriteFromWhiteCanvas(imageUrl: string): Promise<string> {
  const image = await loadSeedreamImage(imageUrl);
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = image.naturalWidth || image.width;
  sourceCanvas.height = image.naturalHeight || image.height;
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) {
    throw new Error("Failed to create Seedream sprite canvas.");
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
    throw new Error("Failed to create cropped Seedream sprite canvas.");
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
  image.src = imageUrl.startsWith("http")
    ? `/seedream-image-proxy?url=${encodeURIComponent(imageUrl)}`
    : imageUrl;

  await image.decode();
  return image;
}
