import { createServer, type IncomingMessage, type Server } from "node:http";
import { pathToFileURL } from "node:url";

import { FileProductStore } from "./productStore.ts";
import {
  createGatewayRouter,
  type GatewayEnvironment,
  type GatewayRouterOptions,
} from "./router.ts";

export interface GatewayServerOptions extends Omit<GatewayRouterOptions, "env"> {
  env?: GatewayEnvironment;
}

const DEFAULT_MAX_BODY_BYTES = 4 * 1024 * 1024;

class PayloadTooLargeError extends Error {}

export function createGatewayServer(options: GatewayServerOptions = {}): Server {
  const env = options.env ?? process.env;
  const route = createGatewayRouter({
    env,
    ...(options.fetcher ? { fetcher: options.fetcher } : {}),
    ...(options.now ? { now: options.now } : {}),
    productStore: options.productStore ?? new FileProductStore(env.PF_PRODUCT_STORE_FILE ?? "./data/product-state.json"),
  });

  return createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? "127.0.0.1";
      const body = await readRequestBody(request, maxBodyBytes(env.PF_GATEWAY_MAX_BODY_BYTES));
      const requestInit: RequestInit = {
        method: request.method ?? "GET",
        headers: request.headers as HeadersInit,
      };
      if (body) {
        requestInit.body = body;
      }
      const routed = await route(new Request(`http://${host}${request.url ?? "/"}`, requestInit));

      response.statusCode = routed.status;
      routed.headers.forEach((value, name) => response.setHeader(name, value));
      response.end(Buffer.from(await routed.arrayBuffer()));
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        response.statusCode = 413;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(JSON.stringify({
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Request body exceeds the configured limit.",
          },
        }));
        return;
      }

      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({
        error: {
          code: "GATEWAY_ERROR",
          message: "Gateway request failed.",
        },
      }));
    }
  });
}

function maxBodyBytes(configured: string | undefined): number {
  const parsed = Number.parseInt(configured ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BODY_BYTES;
}

async function readRequestBody(
  request: IncomingMessage,
  limit: number,
): Promise<Buffer | undefined> {
  const method = request.method ?? "GET";
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return undefined;

  const contentLength = Number.parseInt(request.headers["content-length"] ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > limit) {
    request.resume();
    throw new PayloadTooLargeError();
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > limit) {
      request.resume();
      throw new PayloadTooLargeError();
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

export async function startGatewayServer(
  options: GatewayServerOptions = {},
): Promise<Server> {
  const env = options.env ?? process.env;
  const configuredPort = Number.parseInt(env.PORT ?? "4310", 10);
  const port = Number.isFinite(configuredPort) ? configuredPort : 4310;
  const server = createGatewayServer({ ...options, env });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(`Pocket Friend Gateway listening on port ${port}.`);
  return server;
}

const entryPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entryPath) {
  await startGatewayServer();
}
