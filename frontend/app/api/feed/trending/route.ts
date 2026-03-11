import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "10";

  const res = await fetch(`${BACKEND_URL}/api/feed/trending?limit=${limit}`);

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
