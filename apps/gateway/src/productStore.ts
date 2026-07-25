import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ProductProfile {
  id: string;
  name: string;
  handle: string;
  role: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductResident {
  id: string;
  profileId?: string;
  name: string;
  magnetType: string;
  tags: string[];
  portraitUrl?: string;
  pixelPortraitUrl: string;
  createdAt: string;
  updatedAt: string;
  source: "hardware" | "demo";
  spriteSource: "seedream" | "local-fallback";
  seedreamModel?: string;
  quizAnswers?: Record<string, string>;
  activeSceneId?: string;
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

export interface ProductState {
  profiles: ProductProfile[];
  residents: ProductResident[];
  scenes: ProductScene[];
}

export interface ProductStore {
  getState(): Promise<ProductState>;
  upsertProfile(input: Partial<ProductProfile> & Pick<ProductProfile, "name">): Promise<ProductProfile>;
  upsertResident(input: Partial<ProductResident> & Pick<ProductResident, "id" | "name" | "pixelPortraitUrl">): Promise<ProductResident>;
  listScenes(): Promise<ProductScene[]>;
  listResidents(sceneId?: string): Promise<ProductResident[]>;
}

export const defaultProductScenes: ProductScene[] = [
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
    name: "All-Night Lab",
    shortName: "通宵实验室",
    description: "适合一起调试、补 demo 和安静并肩。",
    assetUrl: "/assets/scenes/all-night-lab.png",
    outerX: 0.24,
    outerY: 0.38,
    walk: { x1: 0.10, x2: 0.90, y1: 0.42, y2: 0.82 },
  },
  {
    id: "pitch-stage",
    name: "Pitch Stage",
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

export class InMemoryProductStore implements ProductStore {
  protected state: ProductState;

  constructor(initialState?: Partial<ProductState>) {
    this.state = {
      profiles: initialState?.profiles ?? [],
      residents: initialState?.residents ?? [],
      scenes: initialState?.scenes ?? defaultProductScenes,
    };
  }

  async getState(): Promise<ProductState> {
    return structuredClone(this.state);
  }

  async upsertProfile(input: Partial<ProductProfile> & Pick<ProductProfile, "name">): Promise<ProductProfile> {
    const now = new Date().toISOString();
    const id = input.id ?? createId("profile", input.name);
    const existing = this.state.profiles.find((profile) => profile.id === id);
    const profile: ProductProfile = {
      id,
      name: input.name.trim() || "Pocket Friend",
      handle: input.handle?.trim() || existing?.handle || "",
      role: input.role?.trim() || existing?.role || "",
      bio: input.bio?.trim() || existing?.bio || "",
      createdAt: existing?.createdAt ?? input.createdAt ?? now,
      updatedAt: now,
    };

    this.state.profiles = [
      profile,
      ...this.state.profiles.filter((candidate) => candidate.id !== id),
    ];
    await this.persist();
    return structuredClone(profile);
  }

  async upsertResident(input: Partial<ProductResident> & Pick<ProductResident, "id" | "name" | "pixelPortraitUrl">): Promise<ProductResident> {
    const now = new Date().toISOString();
    const existing = this.state.residents.find((resident) => resident.id === input.id);
    const resident: ProductResident = {
      id: input.id,
      name: input.name.trim() || "Hardware Photo",
      magnetType: input.magnetType ?? existing?.magnetType ?? "好奇选手",
      tags: input.tags?.length ? input.tags : existing?.tags ?? [],
      pixelPortraitUrl: input.pixelPortraitUrl,
      createdAt: existing?.createdAt ?? input.createdAt ?? now,
      updatedAt: now,
      source: input.source ?? existing?.source ?? "hardware",
      spriteSource: input.spriteSource ?? existing?.spriteSource ?? "seedream",
      activeSceneId: input.activeSceneId ?? existing?.activeSceneId ?? "venture-center",
    };
    const profileId = input.profileId ?? existing?.profileId;
    const portraitUrl = input.portraitUrl ?? existing?.portraitUrl;
    const seedreamModel = input.seedreamModel ?? existing?.seedreamModel;
    const quizAnswers = input.quizAnswers ?? existing?.quizAnswers;
    if (profileId) resident.profileId = profileId;
    if (portraitUrl) resident.portraitUrl = portraitUrl;
    if (seedreamModel) resident.seedreamModel = seedreamModel;
    if (quizAnswers) resident.quizAnswers = quizAnswers;

    this.state.residents = [
      resident,
      ...this.state.residents.filter((candidate) => candidate.id !== resident.id),
    ];
    await this.persist();
    return structuredClone(resident);
  }

  async listScenes(): Promise<ProductScene[]> {
    return structuredClone(this.state.scenes);
  }

  async listResidents(sceneId?: string): Promise<ProductResident[]> {
    const residents = this.state.residents.filter((resident) => {
      if (resident.source === "demo") return false;
      return sceneId ? resident.activeSceneId === sceneId : true;
    });
    return structuredClone(residents);
  }

  protected async persist(): Promise<void> {
    return undefined;
  }
}

export class FileProductStore extends InMemoryProductStore {
  private readonly filePath: string;
  private loaded = false;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  override async getState(): Promise<ProductState> {
    await this.load();
    return await super.getState();
  }

  override async upsertProfile(input: Partial<ProductProfile> & Pick<ProductProfile, "name">): Promise<ProductProfile> {
    await this.load();
    return await super.upsertProfile(input);
  }

  override async upsertResident(input: Partial<ProductResident> & Pick<ProductResident, "id" | "name" | "pixelPortraitUrl">): Promise<ProductResident> {
    await this.load();
    return await super.upsertResident(input);
  }

  override async listScenes(): Promise<ProductScene[]> {
    await this.load();
    return await super.listScenes();
  }

  override async listResidents(sceneId?: string): Promise<ProductResident[]> {
    await this.load();
    return await super.listResidents(sceneId);
  }

  protected override async persist(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(await super.getState(), null, 2), "utf8");
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as Partial<ProductState>;
      this.replaceState({
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        residents: Array.isArray(parsed.residents) ? parsed.residents : [],
        scenes: defaultProductScenes,
      });
    } catch {
      await this.persist();
    }
  }

  private replaceState(nextState: ProductState): void {
    this.state = nextState;
  }
}

function createId(prefix: string, seed: string): string {
  const normalized = seed.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-").replace(/^-|-$/g, "");
  return `${prefix}-${normalized || "guest"}-${Date.now().toString(36)}`;
}
