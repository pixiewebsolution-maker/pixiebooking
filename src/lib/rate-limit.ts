/**
 * Sliding window limiter kept in module memory.
 *
 * Good enough for one long lived Node instance. On serverless each cold
 * instance gets its own window, so swap the store for Upstash/Redis if this
 * ever runs behind heavy ad traffic — see the README.
 */

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();
const SWEEP_AFTER = 5_000;
let lastSweep = 0;

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (now - lastSweep > SWEEP_AFTER) {
    for (const [k, bucket] of buckets) {
      if (bucket.hits.every((t) => now - t > windowMs)) buckets.delete(k);
    }
    lastSweep = now;
  }

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const retryAfterSeconds = Math.ceil((windowMs - (now - bucket.hits[0])) / 1000);
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, remaining: limit - bucket.hits.length, retryAfterSeconds: 0 };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
