import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const limit = searchParams.get("limit") || "10";

    const response = await fetch(
      `${base}/api/search/global?q=${encodeURIComponent(q)}&limit=${limit}`,
      { cache: "no-store" }
    );

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("GET /api/search/global error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
