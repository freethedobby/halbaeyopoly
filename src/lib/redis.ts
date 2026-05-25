import { Redis } from "@upstash/redis";

// Marketplace Redis (Upstash) sets these via env vars on the linked project.
// Both naming conventions are supported so the route works whether the
// integration uses KV_* (legacy) or UPSTASH_REDIS_REST_* (new).
const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  "";
const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  "";

export const redis = url && token ? new Redis({ url, token }) : null;

export const KV_KEYS = {
  visitsTotal: "stats:visits:total",
  visitsToday: (yyyymmdd: string) => `stats:visits:day:${yyyymmdd}`,
  walletsSet: "stats:wallets:unique",
};

export function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}
