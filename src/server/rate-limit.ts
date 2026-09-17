import type { OwnerProfile } from "@/lib/auth/owner";
import type { AppResult } from "@/server/result";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitGate = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/* Pembatas in-memory per instance: meredam spam satu sesi, bukan pengganti rate limit di edge/database. */
export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitGate {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (bucket.count >= limit) return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)) };
  bucket.count += 1;
  return { allowed: true };
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function limitOwnerMutation(owner: OwnerProfile | null, action: string, limit: number, windowMs = 60_000): AppResult<never> | null {
  if (!owner) return null;
  const gate = consumeRateLimit(`${action}:${owner.id}`, limit, windowMs);
  if (gate.allowed) return null;
  return {
    ok: false,
    error: {
      code: "retryable",
      message: `Terlalu banyak percobaan. Coba lagi dalam ${gate.retryAfterSeconds} detik.`,
    },
  };
}
