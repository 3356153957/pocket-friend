import type { Prefs } from "./appFlow.ts";
import type { EncounterProfile } from "./encounterProfile.ts";
import type { ScreenResident } from "./screenResident.ts";

const PRODUCT_API_BASE = (import.meta.env.VITE_PRODUCT_API_BASE_URL as string | undefined) ?? "/product-api";

export interface ProductProfile {
  id: string;
  name: string;
  handle: string;
  role: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductProfileDraft {
  id?: string;
  name: string;
  handle?: string;
  role?: string;
  bio?: string;
}

export interface ProductScene {
  id: string;
  name: string;
  shortName: string;
  description: string;
  assetUrl: string;
  outerX: number;
  outerY: number;
  walk: {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  };
}

export interface ProductResident extends Omit<ScreenResident, "magnetType"> {
  magnetType: ScreenResident["magnetType"];
  profileId?: string;
  updatedAt: string;
  quizAnswers?: Record<string, string>;
  activeSceneId?: string;
}

export const fallbackProductScenes: ProductScene[] = [
  {
    id: "venture-center",
    name: "湖畔创业中心",
    shortName: "创业中心",
    description: "项目共创、桌游和临时灵感碰撞。",
    assetUrl: "/assets/scenes/venture-center.png",
    outerX: 0.43,
    outerY: 0.52,
    walk: { x1: 0.18, x2: 0.88, y1: 0.48, y2: 0.86 },
  },
  {
    id: "all-night-lab",
    name: "通宵实验室",
    shortName: "通宵实验室",
    description: "适合一起调试、完善演示和安静并肩。",
    assetUrl: "/assets/scenes/all-night-lab.png",
    outerX: 0.24,
    outerY: 0.38,
    walk: { x1: 0.10, x2: 0.90, y1: 0.42, y2: 0.82 },
  },
  {
    id: "pitch-stage",
    name: "路演舞台",
    shortName: "路演舞台",
    description: "适合展示、鼓掌和互相记住作品。",
    assetUrl: "/assets/scenes/pitch-stage.png",
    outerX: 0.70,
    outerY: 0.45,
    walk: { x1: 0.16, x2: 0.86, y1: 0.52, y2: 0.90 },
  },
  {
    id: "academic-center",
    name: "杭州未来科技城学术交流中心",
    shortName: "学术交流中心",
    description: "适合正式相遇、会后聊天和深度交换。",
    assetUrl: "/assets/scenes/academic-center.png",
    outerX: 0.58,
    outerY: 0.30,
    walk: { x1: 0.12, x2: 0.88, y1: 0.42, y2: 0.88 },
  },
];

export async function upsertProductProfile(profile: ProductProfileDraft): Promise<ProductProfile> {
  const endpoint = profile.id ? `/profiles/${encodeURIComponent(profile.id)}` : "/profiles";
  const response = await productFetch(endpoint, {
    method: profile.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  const payload = await response.json() as { profile: ProductProfile };
  return payload.profile;
}

export async function saveProductResident(input: {
  profile?: ProductProfile | null;
  resident: ScreenResident;
  prefs: Prefs;
  encounterProfile?: EncounterProfile | undefined;
}): Promise<ProductResident> {
  const activeSceneId = sceneIdForProfile(input.encounterProfile);
  const response = await productFetch("/residents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input.resident,
      profileId: input.profile?.id,
      quizAnswers: input.prefs.quizAnswers,
      activeSceneId,
    }),
  });
  const payload = await response.json() as { resident: ProductResident };
  return payload.resident;
}

export async function listProductScenes(): Promise<ProductScene[]> {
  const response = await productFetch("/scenes");
  const payload = await response.json() as { scenes: ProductScene[] };
  return payload.scenes;
}

export async function listProductResidents(sceneId?: string): Promise<ProductResident[]> {
  const suffix = sceneId ? `?sceneId=${encodeURIComponent(sceneId)}` : "";
  const response = await productFetch(`/residents${suffix}`);
  const payload = await response.json() as { residents: ProductResident[] };
  return payload.residents;
}

export function toScreenResident(resident: ProductResident): ScreenResident {
  const screenResident: ScreenResident = {
    id: resident.id,
    name: resident.name,
    magnetType: resident.magnetType,
    tags: resident.tags,
    pixelPortraitUrl: resident.pixelPortraitUrl,
    createdAt: resident.createdAt,
    source: resident.source,
    spriteSource: resident.spriteSource,
  };
  if (resident.portraitUrl) screenResident.portraitUrl = resident.portraitUrl;
  if (resident.seedreamModel) screenResident.seedreamModel = resident.seedreamModel;
  if (resident.activeSceneId) screenResident.activeSceneId = resident.activeSceneId;
  return screenResident;
}

async function productFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${PRODUCT_API_BASE}${path}`, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`产品服务请求失败，状态码 ${response.status}。`);
  }

  return response;
}

function sceneIdForProfile(profile?: EncounterProfile | undefined): string {
  if (!profile) return "venture-center";
  if (profile.sceneTags.some((tag) => /路演|展示|pitch/i.test(tag))) return "pitch-stage";
  if (profile.sceneTags.some((tag) => /实验|项目|共创|桌游|手作|game/i.test(tag))) return "venture-center";
  if (profile.sceneTags.some((tag) => /深聊|学术|交流|书店|咖啡/i.test(tag))) return "academic-center";
  return profile.sceneTags.some((tag) => /夜晚|live|电影/i.test(tag)) ? "all-night-lab" : "venture-center";
}
