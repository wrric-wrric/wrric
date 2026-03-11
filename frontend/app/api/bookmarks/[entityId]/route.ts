import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entityId: string }> }
) {
  const { entityId } = await params;
  const token = request.headers.get("authorization") || "";

  const res = await fetch(`${BACKEND_URL}/api/bookmarks/${entityId}`, {
    method: "DELETE",
    headers: { Authorization: token },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
