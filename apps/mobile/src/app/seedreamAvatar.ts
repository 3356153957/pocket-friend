const DOUBAO_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const DEFAULT_DOUBAO_MODEL = "doubao-seedream-5-0-260128";
const SEEDREAM_TIMEOUT_MS = 60000;

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
  compressedReferenceDataUrl: string;
  model: string;
}

export async function generateSeedreamPixelAvatar(referenceDataUrl: string): Promise<SeedreamGenerationResult> {
  const apiKey = import.meta.env.VITE_DOUBAO_API_KEY as string | undefined;
  const model = (import.meta.env.VITE_DOUBAO_MODEL as string | undefined) ?? DEFAULT_DOUBAO_MODEL;

  if (!apiKey) {
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

  const imageUrl = payload?.data?.[0]?.url ?? payload?.data?.[0]?.b64_json;
  if (!imageUrl) {
    throw new Error(`Seedream returned no image URL for model ${model}.`);
  }

  return {
    imageUrl: imageUrl.startsWith("http") ? imageUrl : `data:image/png;base64,${imageUrl}`,
    compressedReferenceDataUrl: referenceDataUrl,
    model,
  };
}

async function fetchSeedreamWithTimeout(body: Record<string, unknown>): Promise<Response> {
  const apiKey = import.meta.env.VITE_DOUBAO_API_KEY as string | undefined;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), SEEDREAM_TIMEOUT_MS);

  try {
    return await fetch(DOUBAO_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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
