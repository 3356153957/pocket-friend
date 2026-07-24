import {
  fetchJacooLatestLocation,
  JacooGatewayError,
  type JacooEnvironment,
} from "./jacoo.ts";
import { storePhotoUpload } from "./photos.ts";

export type GatewayEnvironment = Record<string, string | undefined>;

export interface GatewayRouterOptions {
  env: GatewayEnvironment;
  fetcher?: (input: string | URL, init?: RequestInit) => Promise<Response>;
  now?: () => Date;
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

  return new Response(JSON.stringify(body), { status, headers });
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
  return async (request) => {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      const response = jsonResponse({}, 204, options.env);
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

      return storePhotoUpload(request, {
        env: options.env,
        ...(options.now ? { now: options.now } : {}),
      });
    }

    if (request.method !== "GET") {
      return jsonResponse({
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Only GET requests are supported.",
        },
      }, 405, options.env);
    }

    if (url.pathname === "/health") {
      return jsonResponse({
        status: "ok",
        service: "pocket-friend-gateway",
      }, 200, options.env);
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
