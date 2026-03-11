import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const url = `${BACKEND_URL}/api/admin/analytics/engagement${query ? `?${query}` : ""}`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const auth = request.headers.get("authorization");
    if (auth) headers["Authorization"] = auth;

    const res = await fetch(url, { method: "GET", headers, cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("GET /api/admin/analytics/engagement error:", error);
    return NextResponse.json({ error: "Failed to fetch engagement analytics" }, { status: 500 });
  }
}
