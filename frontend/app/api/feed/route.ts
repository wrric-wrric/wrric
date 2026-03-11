import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") || "";
  const limit = searchParams.get("limit") || "20";

  const token = request.headers.get("authorization") || "";

  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", limit);

  const res = await fetch(`${BACKEND_URL}/api/feed?${params.toString()}`, {
    headers: { Authorization: token },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
