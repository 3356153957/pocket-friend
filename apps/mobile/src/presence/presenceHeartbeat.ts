export interface PresenceLocation {
  protocol: string;
  hostname: string;
}

export interface PresenceHeartbeatOptions {
  endpoint: string;
  clientId: string;
  fetcher?: typeof fetch;
  intervalMs?: number;
  setIntervalFn?: (callback: () => void, delay: number) => unknown;
  clearIntervalFn?: (handle: unknown) => void;
}

export function createPresenceUrl(location: PresenceLocation, configuredBaseUrl?: string): string {
  const baseUrl = configuredBaseUrl?.trim()
    ? configuredBaseUrl.trim().replace(/\/$/u, "")
    : `${location.protocol}//${location.hostname}:4311`;
  return `${baseUrl}/api/heartbeat`;
}

export function getPresenceClientId(storage: Pick<Storage, "getItem" | "setItem">, randomId: () => string): string {
  const key = "pf-presence-client-id";
  const existing = storage.getItem(key);
  if (existing) return existing;
  const created = randomId();
  storage.setItem(key, created);
  return created;
}

export function startPresenceHeartbeat(options: PresenceHeartbeatOptions): () => void {
  const fetcher = options.fetcher ?? fetch;
  const setIntervalFn = options.setIntervalFn ?? ((callback, delay) => setInterval(callback, delay));
  const clearIntervalFn = options.clearIntervalFn ?? ((handle) => clearInterval(handle as ReturnType<typeof setInterval>));
  const report = () => {
    void fetcher(options.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "web", clientId: options.clientId }),
      keepalive: true,
    }).catch(() => undefined);
  };
  report();
  const handle = setIntervalFn(report, options.intervalMs ?? 15_000);
  return () => clearIntervalFn(handle);
}
