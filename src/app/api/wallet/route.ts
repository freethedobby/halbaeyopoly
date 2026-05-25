import { NextResponse } from "next/server";
import { fetchWalletStats } from "@/lib/polymarket";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = url.searchParams.get("address")?.trim();
  if (!address || !ADDR_RE.test(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  try {
    const stats = await fetchWalletStats(address);
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
