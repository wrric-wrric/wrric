import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments } = await params;
  const path = pathSegments.join("/");
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const url = `${BACKEND_URL}/api/judge/${path}${query ? `?${query}` : ""}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const auth = request.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  const fetchOptions: RequestInit = { method: request.method, headers };
  if (["POST", "PATCH", "PUT"].includes(request.method)) {
    const body = await request.text();
    if (body) {
      fetchOptions.body = body;
    }
  }

  const res = await fetch(url, fetchOptions);
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
export const PUT = handler;
