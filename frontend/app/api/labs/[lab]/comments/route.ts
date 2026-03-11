import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ lab: string }> }
) {
  try {
    const { lab } = await context.params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const res = await fetch(`${BACKEND_URL}/api/labs/${lab}/comments${query ? `?${query}` : ""}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

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

    const res = await fetch(`${BACKEND_URL}/api/labs/${lab}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
