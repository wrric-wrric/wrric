import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ lab: string }> }
) {
  try {
    const { lab } = await context.params;
    const body = await request.json();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const auth = request.headers.get("authorization");
    if (auth) headers["Authorization"] = auth;

    const res = await fetch(`${BACKEND_URL}/api/labs/${lab}/share`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to record share" }, { status: 500 });
  }
}
