import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lab: string }> }
) {
  try {
    const { lab } = await params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const url = `${BACKEND_URL}/api/labs/${lab}/analytics${query ? `?${query}` : ""}`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const auth = request.headers.get("authorization");
    if (auth) headers["Authorization"] = auth;

    const res = await fetch(url, { method: "GET", headers, cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("GET /api/labs/[lab]/analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch lab analytics" }, { status: 500 });
  }
}
