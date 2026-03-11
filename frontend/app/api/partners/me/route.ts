import { NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    // Backend endpoint is /api/partners/me
    const res = await fetch(`${BACKEND}/api/partners/me`, {
      headers: { Authorization: auth },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Failed to fetch my partners:", error);
    return NextResponse.json({ detail: "Failed to fetch partners" }, { status: 500 });
  }
}
