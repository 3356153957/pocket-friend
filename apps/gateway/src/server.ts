import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";

import {
  createGatewayRouter,
  type GatewayEnvironment,
  type GatewayRouterOptions,
} from "./router.ts";

export interface GatewayServerOptions extends Omit<GatewayRouterOptions, "env"> {
  env?: GatewayEnvironment;
}

export function createGatewayServer(options: GatewayServerOptions = {}): Server {
  const env = options.env ?? process.env;
  const route = createGatewayRouter({
    env,
    ...(options.fetcher ? { fetcher: options.fetcher } : {}),
    ...(options.now ? { now: options.now } : {}),
  });

  return createServer(async (request, response) => {
    try {
      const host = request.headers.host ?? "127.0.0.1";
      const routed = await route(new Request(`http://${host}${request.url ?? "/"}`, {
        method: request.method ?? "GET",
        headers: request.headers as HeadersInit,
      }));

      response.statusCode = routed.status;
      routed.headers.forEach((value, name) => response.setHeader(name, value));
      response.end(Buffer.from(await routed.arrayBuffer()));
    } catch {
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
