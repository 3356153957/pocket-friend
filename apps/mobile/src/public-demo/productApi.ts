const now = () => new Date().toISOString();

interface PublicDemoProfileDraft {
  id?: string;
  name: string;
  handle?: string;
  role?: string;
  bio?: string;
}

export const fallbackProductScenes = [
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

export async function upsertProductProfile(profile: PublicDemoProfileDraft) {
  const timestamp = now();
  return {
    id: profile.id ?? `local-${Date.now().toString(36)}`,
    name: profile.name,
    handle: profile.handle ?? profile.name,
    role: profile.role ?? "",
    bio: profile.bio ?? "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function saveProductResident({ resident }: { resident: Record<string, unknown> }) {
  return { ...resident, updatedAt: now() };
}

export async function listProductScenes() {
  return fallbackProductScenes;
}

export async function listProductResidents() {
  return [];
}

export function toScreenResident<T>(resident: T): T {
  return resident;
}
