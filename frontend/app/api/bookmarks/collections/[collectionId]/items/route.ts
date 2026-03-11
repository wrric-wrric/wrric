import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;
  const token = request.headers.get("authorization") || "";

  const res = await fetch(
    `${BACKEND_URL}/api/bookmarks/collections/${collectionId}/items`,
    { headers: { Authorization: token } }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  const { collectionId } = await params;
  const token = request.headers.get("authorization") || "";
  const body = await request.json();

  const res = await fetch(
    `${BACKEND_URL}/api/bookmarks/collections/${collectionId}/items`,
    {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
