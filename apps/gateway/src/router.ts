import {
  fetchJacooLatestLocation,
  JacooGatewayError,
  type JacooEnvironment,
} from "./jacoo.ts";
import { storePhotoUpload } from "./photos.ts";
import {
  InMemoryProductStore,
  type ProductStore,
} from "./productStore.ts";
import {
  generateSeedreamAvatar,
  SeedreamGatewayError,
} from "./seedream.ts";

export type GatewayEnvironment = Record<string, string | undefined>;

export interface GatewayRouterOptions {
  env: GatewayEnvironment;
  fetcher?: (input: string | URL, init?: RequestInit) => Promise<Response>;
  now?: () => Date;
  productStore?: ProductStore;
}

export type GatewayRouter = (request: Request) => Promise<Response>;

function environment(value: string | undefined): JacooEnvironment {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
}

function corsOrigin(env: GatewayEnvironment): string {
  if (env.PF_ALLOWED_ORIGIN) {
    return env.PF_ALLOWED_ORIGIN;
  }

  return env.NODE_ENV === "production" ? "" : "*";
}

function seedreamApiKey(env: GatewayEnvironment): string {
  return env.DOUBAO_API_KEY ?? env.VITE_DOUBAO_API_KEY ?? "";
}

function seedreamModel(env: GatewayEnvironment): string | undefined {
  return env.DOUBAO_MODEL ?? env.VITE_DOUBAO_MODEL;
}

function jsonResponse(
  body: unknown,
  status: number,
  env: GatewayEnvironment,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  const origin = corsOrigin(env);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

function withCors(response: Response, env: GatewayEnvironment): Response {
  const origin = corsOrigin(env);
  if (origin) response.headers.set("Access-Control-Allow-Origin", origin);
  return response;
}

function authorizeServerApi(request: Request, env: GatewayEnvironment): Response | null {
  const token = env.PF_PRODUCT_API_TOKEN?.trim();
  if (!token) {
    return env.NODE_ENV === "production"
      ? jsonResponse({
          error: {
            code: "PRODUCT_API_MISSING_CONFIG",
            message: "Product API authentication is not configured.",
          },
        }, 503, env)
      : null;
  }

  if (request.headers.get("Authorization") !== `Bearer ${token}`) {
    return jsonResponse({
      error: {
        code: "UNAUTHORIZED",
        message: "API request is not authorized.",
      },
    }, 401, env);
  }

  return null;
}

function errorStatus(error: JacooGatewayError): number {
  if (error.code === "JACOO_DISABLED") {
    return 404;
  }

  if (error.code === "JACOO_MISSING_CONFIG" || error.code === "JACOO_FETCH_UNAVAILABLE") {
    return 503;
  }

  return 502;
}

export function createGatewayRouter(options: GatewayRouterOptions): GatewayRouter {
  const productStore = options.productStore ?? new InMemoryProductStore();

  return async (request) => {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const response = jsonResponse({}, 204, options.env);
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
      return response;
    }

    if (url.pathname === "/api/photos") {
      if (request.method !== "POST") {
        return jsonResponse({
          error: {
            code: "METHOD_NOT_ALLOWED",
            message: "Only POST requests are supported.",
          },
        }, 405, options.env);
      }

      return withCors(await storePhotoUpload(request, {
        env: options.env,
        ...(options.now ? { now: options.now } : {}),
      }), options.env);
    }

    if (url.pathname === "/api/avatar/generate") {
      const authResponse = authorizeServerApi(request, options.env);
      if (authResponse) return authResponse;
      return await handleAvatarGeneration(request, options);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        status: "ok",
        service: "pocket-friend-gateway",
      }, 200, options.env);
    }

    if (url.pathname.startsWith("/api/product/")) {
      const authResponse = authorizeServerApi(request, options.env);
      if (authResponse) return authResponse;
      return await handleProductRequest(request, url, productStore, options.env);
    }

    if (request.method !== "GET") {
      return jsonResponse({
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "This route does not support the requested method.",
        },
      }, 405, options.env);
    }

    if (url.pathname === "/api/location/jacoo/latest") {
      try {
        const result = await fetchJacooLatestLocation({
          enabled: options.env.PF_ENABLE_JACOO === "true",
          environment: environment(options.env.NODE_ENV),
          baseUrl: options.env.JACOO_BASE_URL ?? "",
          apiKey: options.env.JACOO_API_KEY ?? "",
          ...(options.fetcher ? { fetcher: options.fetcher } : {}),
          ...(options.now ? { now: options.now } : {}),
        });

        return jsonResponse(result, 200, options.env);
      } catch (error) {
        if (error instanceof JacooGatewayError) {
          return jsonResponse({
            error: {
              code: error.code,
              message: error.message,
            },
          }, errorStatus(error), options.env);
        }

        return jsonResponse({
          error: {
            code: "GATEWAY_ERROR",
            message: "Gateway request failed.",
          },
        }, 500, options.env);
      }
    }

    return jsonResponse({
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
    }, 404, options.env);
  };
}

async function handleAvatarGeneration(
  request: Request,
  options: GatewayRouterOptions,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Only POST requests are supported.",
      },
    }, 405, options.env);
  }

  try {
    const body = await readJsonBody<Record<string, unknown>>(request);
    if (typeof body.image !== "string" || !body.image.startsWith("data:image/")) {
      return jsonResponse({
        error: {
          code: "SEEDREAM_IMAGE_REQUIRED",
          message: "A data URL image is required.",
        },
      }, 400, options.env);
    }

    const model = seedreamModel(options.env);
    const result = await generateSeedreamAvatar({
      apiKey: seedreamApiKey(options.env),
      image: body.image,
      ...(model ? { model } : {}),
      ...(options.env.DOUBAO_ENDPOINT ? { endpoint: options.env.DOUBAO_ENDPOINT } : {}),
      ...(options.fetcher ? { fetcher: options.fetcher } : {}),
    });
    return jsonResponse(result, 200, options.env);
  } catch (error) {
    if (error instanceof SeedreamGatewayError) {
      return jsonResponse({
        error: {
          code: error.code,
          message: error.message,
        },
      }, error.status, options.env);
    }

    return jsonResponse({
      error: {
        code: "SEEDREAM_GATEWAY_ERROR",
        message: "Seedream generation failed.",
      },
    }, 502, options.env);
  }
}

async function handleProductRequest(
  request: Request,
  url: URL,
  productStore: ProductStore,
  env: GatewayEnvironment,
): Promise<Response> {
  try {
    if (request.method === "GET" && url.pathname === "/api/product/state") {
      return jsonResponse(await productStore.getState(), 200, env);
    }

    if (request.method === "GET" && url.pathname === "/api/product/scenes") {
      return jsonResponse({ scenes: await productStore.listScenes() }, 200, env);
    }

    if (request.method === "GET" && url.pathname === "/api/product/residents") {
      return jsonResponse({
        residents: await productStore.listResidents(url.searchParams.get("sceneId") ?? undefined),
      }, 200, env);
    }

    if (request.method === "POST" && url.pathname === "/api/product/profiles") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      if (typeof body.name !== "string" || !body.name.trim()) {
        return jsonResponse({
          error: {
            code: "PROFILE_NAME_REQUIRED",
            message: "Profile name is required.",
          },
        }, 400, env);
      }

      return jsonResponse({
        profile: await productStore.upsertProfile(buildProfileInput(body, body.name)),
      }, 200, env);
    }

    const profileMatch = url.pathname.match(/^\/api\/product\/profiles\/([^/]+)$/);
    if ((request.method === "PATCH" || request.method === "PUT") && profileMatch) {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const id = decodeURIComponent(profileMatch[1] ?? "");
      const name = typeof body.name === "string" && body.name.trim() ? body.name : "Pocket Friend";
      return jsonResponse({
        profile: await productStore.upsertProfile(buildProfileInput(body, name, id)),
      }, 200, env);
    }

    if (request.method === "POST" && url.pathname === "/api/product/residents") {
      const body = await readJsonBody<Record<string, unknown>>(request);
      const resident = normalizeResidentBody(body);
      if (!resident) {
        return jsonResponse({
          error: {
            code: "RESIDENT_REQUIRED",
            message: "Resident id, name, and pixelPortraitUrl are required.",
          },
        }, 400, env);
      }

      return jsonResponse({
        resident: await productStore.upsertResident(resident),
      }, 200, env);
    }

    return jsonResponse({
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
    }, 404, env);
  } catch {
    return jsonResponse({
      error: {
        code: "PRODUCT_API_ERROR",
        message: "Product API request failed.",
      },
    }, 500, env);
  }
}

async function readJsonBody<T>(request: Request): Promise<T> {
  return await request.json() as T;
}

function normalizeResidentBody(body: Record<string, unknown>) {
  if (typeof body.id !== "string" || typeof body.name !== "string" || typeof body.pixelPortraitUrl !== "string") {
    return null;
  }

  const resident = {
    id: body.id,
    name: body.name,
    pixelPortraitUrl: body.pixelPortraitUrl,
    source: body.source === "demo" ? "demo" as const : "hardware" as const,
    spriteSource: body.spriteSource === "local-fallback" ? "local-fallback" as const : "seedream" as const,
  };
  if (typeof body.profileId === "string") Object.assign(resident, { profileId: body.profileId });
  if (typeof body.magnetType === "string") Object.assign(resident, { magnetType: body.magnetType });
  if (Array.isArray(body.tags)) Object.assign(resident, { tags: body.tags.filter((tag): tag is string => typeof tag === "string") });
  if (typeof body.portraitUrl === "string") Object.assign(resident, { portraitUrl: body.portraitUrl });
  if (typeof body.createdAt === "string") Object.assign(resident, { createdAt: body.createdAt });
  if (typeof body.seedreamModel === "string") Object.assign(resident, { seedreamModel: body.seedreamModel });
  if (isStringRecord(body.quizAnswers)) Object.assign(resident, { quizAnswers: body.quizAnswers });
  if (typeof body.activeSceneId === "string") Object.assign(resident, { activeSceneId: body.activeSceneId });
  return resident;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((item) => typeof item === "string");
}

function buildProfileInput(body: Record<string, unknown>, name: string, id?: string) {
  const input = { name };
  if (id) Object.assign(input, { id });
  else if (typeof body.id === "string") Object.assign(input, { id: body.id });
  if (typeof body.handle === "string") Object.assign(input, { handle: body.handle });
  if (typeof body.role === "string") Object.assign(input, { role: body.role });
  if (typeof body.bio === "string") Object.assign(input, { bio: body.bio });
  return input;
}
