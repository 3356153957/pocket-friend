export interface AuthThrottleOptions {
  /** Failed attempts allowed inside the window before a lockout. */
  maxFailures?: number;
  /** Window in which failures accumulate before the counter resets. */
  windowMs?: number;
  /** How long a key stays locked after too many failures. */
  lockoutMs?: number;
}

interface AttemptState {
  failures: number;
  lastFailureAt: number;
  lockedUntil: number;
}

const MAX_TRACKED_KEYS = 1000;

/** In-memory brute-force guard keyed by auth scope and client address. */
export class AuthThrottle {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;

  constructor(options: AuthThrottleOptions = {}) {
    this.maxFailures = options.maxFailures ?? 5;
    this.windowMs = options.windowMs ?? 15 * 60 * 1000;
    this.lockoutMs = options.lockoutMs ?? 5 * 60 * 1000;
  }

  /** Seconds until the key may retry, or 0 when it is not locked. */
  retryAfterSeconds(key: string, nowMs: number): number {
    const state = this.attempts.get(key);
    if (!state || state.lockedUntil <= nowMs) return 0;
    return Math.ceil((state.lockedUntil - nowMs) / 1000);
  }

  recordFailure(key: string, nowMs: number): void {
    this.prune(nowMs);
    let state = this.attempts.get(key);
    if (!state || nowMs - state.lastFailureAt > this.windowMs) {
      state = { failures: 0, lastFailureAt: nowMs, lockedUntil: 0 };
      this.attempts.set(key, state);
    }
    state.failures += 1;
    state.lastFailureAt = nowMs;
    if (state.failures >= this.maxFailures) {
      state.lockedUntil = nowMs + this.lockoutMs;
      state.failures = 0;
    }
  }

  recordSuccess(key: string): void {
    this.attempts.delete(key);
  }

  private prune(nowMs: number): void {
    if (this.attempts.size < MAX_TRACKED_KEYS) return;
    for (const [key, state] of this.attempts) {
      if (state.lockedUntil <= nowMs && nowMs - state.lastFailureAt > this.windowMs) {
        this.attempts.delete(key);
      }
    }
  }
}
