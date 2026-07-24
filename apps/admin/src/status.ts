export type DeviceId = "web" | "board-a" | "board-b";

export interface Heartbeat {
  deviceId: DeviceId;
  clientId?: string;
  firmwareVersion?: string;
  batteryPercent?: number;
  userAgent?: string;
  ip?: string;
}

export interface WebSessionInfo {
  clientId: string;
  lastSeenAt: string;
  ageMs: number;
  browser: string;
  os: string;
  ip: string;
}

export interface DeviceStatus {
  id: DeviceId;
  label: string;
  kind: "web" | "board";
  online: boolean;
  lastSeenAt: string | null;
  ageMs: number | null;
  sessions?: WebSessionInfo[];
  firmwareVersion?: string;
  batteryPercent?: number;
}

export interface StatusSnapshot {
  generatedAt: string;
  offlineAfterMs: number;
  summary: {
    online: number;
    total: number;
  };
  devices: DeviceStatus[];
}


interface DeviceRecord {
  lastSeenMs: number;
  firmwareVersion?: string;
  batteryPercent?: number;
}

interface WebSession {
  lastSeenMs: number;
  userAgent: string;
  ip: string;
}

const definitions = [
  { id: "web", label: "网页端", kind: "web" },
  { id: "board-a", label: "开发板 A", kind: "board" },
  { id: "board-b", label: "开发板 B", kind: "board" },
] as const;

function parseBrowser(userAgent: string): { browser: string; os: string } {
  let browser = "Unknown";
  let os = "Unknown";

  if (userAgent.includes("Edg/")) {
    browser = "Edge";
  } else if (userAgent.includes("Chrome/")) {
    browser = "Chrome";
  } else if (userAgent.includes("Firefox/")) {
    browser = "Firefox";
  } else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) {
    browser = "Safari";
  }

  if (userAgent.includes("Windows")) {
    os = "Windows";
  } else if (userAgent.includes("Mac OS")) {
    os = "macOS";
  } else if (userAgent.includes("Android")) {
    os = "Android";
  } else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    os = "iOS";
  } else if (userAgent.includes("Linux")) {
    os = "Linux";
  }

  return { browser, os };
}

export class DeviceStatusRegistry {
  readonly offlineAfterMs: number;
  private readonly devices = new Map<DeviceId, DeviceRecord>();
  private readonly webSessions = new Map<string, WebSession>();

  constructor(options: { offlineAfterMs?: number } = {}) {
    this.offlineAfterMs = options.offlineAfterMs ?? 45_000;
  }

  record(heartbeat: Heartbeat, receivedAtMs = Date.now()): void {
    if (heartbeat.deviceId === "web") {
      if (!heartbeat.clientId) {
        throw new Error("Web heartbeat requires a clientId.");
      }
      this.webSessions.set(heartbeat.clientId, {
        lastSeenMs: receivedAtMs,
        userAgent: heartbeat.userAgent ?? "Unknown",
        ip: heartbeat.ip ?? "Unknown",
      });
    }

    const previous = this.devices.get(heartbeat.deviceId);
    this.devices.set(heartbeat.deviceId, {
      lastSeenMs: receivedAtMs,
      ...(heartbeat.firmwareVersion
        ? { firmwareVersion: heartbeat.firmwareVersion }
        : previous?.firmwareVersion
          ? { firmwareVersion: previous.firmwareVersion }
          : {}),
      ...(heartbeat.batteryPercent !== undefined
        ? { batteryPercent: heartbeat.batteryPercent }
        : previous?.batteryPercent !== undefined
          ? { batteryPercent: previous.batteryPercent }
          : {}),
    });
  }

  snapshot(nowMs = Date.now()): StatusSnapshot {
    for (const [clientId, session] of this.webSessions) {
      if (!this.isOnline(session.lastSeenMs, nowMs)) {
        this.webSessions.delete(clientId);
      }
    }

    const devices = definitions.map((definition): DeviceStatus => {
      const record = this.devices.get(definition.id);
      const online = record ? this.isOnline(record.lastSeenMs, nowMs) : false;

      let sessions: WebSessionInfo[] | undefined;
      if (definition.id === "web") {
        sessions = [];
        for (const [clientId, ws] of this.webSessions) {
          const { browser, os } = parseBrowser(ws.userAgent);
          sessions.push({
            clientId,
            lastSeenAt: new Date(ws.lastSeenMs).toISOString(),
            ageMs: Math.max(0, nowMs - ws.lastSeenMs),
            browser,
            os,
            ip: ws.ip,
          });
        }
        sessions.sort((a, b) => a.ageMs - b.ageMs);
      }

      return {
        ...definition,
        online,
        lastSeenAt: record ? new Date(record.lastSeenMs).toISOString() : null,
        ageMs: record ? Math.max(0, nowMs - record.lastSeenMs) : null,
        ...(sessions ? { sessions } : {}),
        ...(record?.firmwareVersion
          ? { firmwareVersion: record.firmwareVersion }
          : {}),
        ...(record?.batteryPercent !== undefined
          ? { batteryPercent: record.batteryPercent }
          : {}),
      };
    });

    return {
      generatedAt: new Date(nowMs).toISOString(),
      offlineAfterMs: this.offlineAfterMs,
      summary: {
        online: devices.filter(({ online }) => online).length,
        total: devices.length,
      },
      devices,
    };
  }

  private isOnline(lastSeenMs: number, nowMs: number): boolean {
    return nowMs - lastSeenMs < this.offlineAfterMs;
  }
}
