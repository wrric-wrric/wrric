import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ lab: string }> }
) {
  try {
    const { lab } = await context.params;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const auth = request.headers.get("authorization");
    if (auth) headers["Authorization"] = auth;

    const res = await fetch(`${BACKEND_URL}/api/labs/${lab}/like`, {
      method: "POST",
      headers,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("POST /api/labs/[lab]/like error:", error);
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
