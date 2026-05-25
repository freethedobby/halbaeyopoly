import { NextResponse } from "next/server";
import { redis, KV_KEYS, todayKey } from "@/lib/redis";

export const dynamic = "force-dynamic";

type StatsBody = { action?: "visit" | "wallet"; wallet?: string };

export async function POST(req: Request) {
  if (!redis) return NextResponse.json({ ok: false, reason: "no-kv" }, { status: 200 });
  let body: StatsBody = {};
  try {
    body = (await req.json()) as StatsBody;
  } catch {
    // empty body acts like a visit ping
  }
  if (body.action === "wallet" && typeof body.wallet === "string" && /^0x[a-fA-F0-9]{40}$/.test(body.wallet)) {
    await redis.sadd(KV_KEYS.walletsSet, body.wallet.toLowerCase());
    return NextResponse.json({ ok: true });
  }
  // default: count as a visit
  const today = todayKey();
  const [total, day] = await Promise.all([
    redis.incr(KV_KEYS.visitsTotal),
    redis.incr(KV_KEYS.visitsToday(today)),
  ]);
  // 14-day TTL so old daily counters don't pile up
  await redis.expire(KV_KEYS.visitsToday(today), 60 * 60 * 24 * 14);
  return NextResponse.json({ ok: true, total, day });
}

export async function GET() {
  if (!redis) {
    return NextResponse.json(
      { total: null, today: null, uniqueWallets: null, reason: "no-kv" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  const today = todayKey();
  const [total, day, uniqueWallets] = await Promise.all([
    redis.get<number>(KV_KEYS.visitsTotal),
    redis.get<number>(KV_KEYS.visitsToday(today)),
    redis.scard(KV_KEYS.walletsSet),
  ]);
  return NextResponse.json(
    {
      total: total ?? 0,
      today: day ?? 0,
      uniqueWallets: uniqueWallets ?? 0,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
