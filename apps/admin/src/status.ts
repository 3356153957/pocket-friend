export type DeviceId = "web" | "board-a" | "board-b";

export interface Heartbeat {
  deviceId: DeviceId;
  clientId?: string;
  firmwareVersion?: string;
  batteryPercent?: number;
}

export interface DeviceStatus {
  id: DeviceId;
  label: string;
  kind: "web" | "board";
  online: boolean;
  lastSeenAt: string | null;
  ageMs: number | null;
  activeSessions?: number;
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

const definitions = [
  { id: "web", label: "网页端", kind: "web" },
  { id: "board-a", label: "开发板 A", kind: "board" },
  { id: "board-b", label: "开发板 B", kind: "board" },
] as const;

export class DeviceStatusRegistry {
  readonly offlineAfterMs: number;
  private readonly devices = new Map<DeviceId, DeviceRecord>();
  private readonly webSessions = new Map<string, number>();

  constructor(options: { offlineAfterMs?: number } = {}) {
    this.offlineAfterMs = options.offlineAfterMs ?? 45_000;
  }

  record(heartbeat: Heartbeat, receivedAtMs = Date.now()): void {
    if (heartbeat.deviceId === "web") {
      if (!heartbeat.clientId) {
        throw new Error("Web heartbeat requires a clientId.");
      }
      this.webSessions.set(heartbeat.clientId, receivedAtMs);
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
    for (const [clientId, lastSeenMs] of this.webSessions) {
      if (!this.isOnline(lastSeenMs, nowMs)) {
        this.webSessions.delete(clientId);
      }
    }

    const devices = definitions.map((definition): DeviceStatus => {
      const record = this.devices.get(definition.id);
      const online = record ? this.isOnline(record.lastSeenMs, nowMs) : false;
      return {
        ...definition,
        online,
        lastSeenAt: record ? new Date(record.lastSeenMs).toISOString() : null,
        ageMs: record ? Math.max(0, nowMs - record.lastSeenMs) : null,
        ...(definition.id === "web"
          ? { activeSessions: this.webSessions.size }
          : {}),
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
