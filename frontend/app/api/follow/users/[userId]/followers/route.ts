import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const res = await fetch(
      `${BACKEND_URL}/api/follow/users/${userId}/followers${query ? `?${query}` : ""}`,
      { headers: { "Content-Type": "application/json" } }
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ error: "Failed to get followers" }, { status: 500 });
  }
}
