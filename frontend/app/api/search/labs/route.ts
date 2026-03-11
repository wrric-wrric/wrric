import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";
    const { searchParams } = new URL(request.url);

    // Forward all query params
    const params = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
      params.set(key, value);
    }

    const response = await fetch(`${base}/api/search/labs?${params.toString()}`, {
      cache: "no-store",
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("GET /api/search/labs error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
