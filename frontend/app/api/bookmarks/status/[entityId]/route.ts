import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityId: string }> }
) {
  const { entityId } = await params;
  const token = request.headers.get("authorization") || "";

  const res = await fetch(`${BACKEND_URL}/api/bookmarks/status/${entityId}`, {
    headers: { Authorization: token },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
