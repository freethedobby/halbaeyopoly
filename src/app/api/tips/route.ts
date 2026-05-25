import { NextResponse } from "next/server";

const ADDRESS = "0xeB26869ac8B9F9EE306327D460953453832A8810";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";

const API_BASE = "https://api.etherscan.io/api";
const API_KEY = process.env.ETHERSCAN_API_KEY || "";

type EthTx = {
  to: string;
  from: string;
  value: string;
  isError: string;
  contractAddress: string;
};

type TokenTx = {
  to: string;
  from: string;
  value: string;
  contractAddress: string;
  tokenDecimal: string;
  tokenSymbol: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`etherscan ${res.status}`);
  return (await res.json()) as T;
}

async function fetchEthIn(): Promise<bigint> {
  const url = `${API_BASE}?module=account&action=txlist&address=${ADDRESS}&startblock=0&endblock=99999999&sort=asc${API_KEY ? `&apikey=${API_KEY}` : ""}`;
  const json = await getJson<{ status: string; result: EthTx[] | string }>(url);
  if (json.status !== "1" || !Array.isArray(json.result)) return 0n;
  let total = 0n;
  const me = ADDRESS.toLowerCase();
  for (const tx of json.result) {
    if (tx.isError === "1") continue;
    if (tx.to?.toLowerCase() !== me) continue;
    total += BigInt(tx.value || "0");
  }
  return total;
}

async function fetchTokenIn(token: string): Promise<bigint> {
  const url = `${API_BASE}?module=account&action=tokentx&contractaddress=${token}&address=${ADDRESS}&startblock=0&endblock=99999999&sort=asc${API_KEY ? `&apikey=${API_KEY}` : ""}`;
  const json = await getJson<{ status: string; result: TokenTx[] | string }>(url);
  if (json.status !== "1" || !Array.isArray(json.result)) return 0n;
  let total = 0n;
  const me = ADDRESS.toLowerCase();
  for (const tx of json.result) {
    if (tx.to?.toLowerCase() !== me) continue;
    total += BigInt(tx.value || "0");
  }
  return total;
}

async function ethUsdPrice(): Promise<number> {
  try {
    const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
      next: { revalidate: 300 },
    });
    if (!res.ok) return 0;
    const json = (await res.json()) as { data?: { amount?: string } };
    return Number(json.data?.amount || 0);
  } catch {
    return 0;
  }
}

export const revalidate = 300; // cache for 5 minutes

export async function GET() {
  try {
    const [ethWei, usdc6, usdt6, ethPx] = await Promise.all([
      fetchEthIn().catch(() => 0n),
      fetchTokenIn(USDC).catch(() => 0n),
      fetchTokenIn(USDT).catch(() => 0n),
      ethUsdPrice(),
    ]);

    const ethAmount = Number(ethWei) / 1e18;
    const usdcAmount = Number(usdc6) / 1e6;
    const usdtAmount = Number(usdt6) / 1e6;
    const totalUsd = ethAmount * ethPx + usdcAmount + usdtAmount;

    return NextResponse.json(
      {
        address: ADDRESS,
        ethAmount,
        usdcAmount,
        usdtAmount,
        ethPriceUsd: ethPx,
        totalUsd,
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
