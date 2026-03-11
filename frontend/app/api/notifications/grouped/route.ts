import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("Authorization") || "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";
    const { searchParams } = new URL(request.url);
    const unread_only = searchParams.get("unread_only") || "false";
    const limit = searchParams.get("limit") || "30";

    const res = await fetch(
      `${base}/api/notifications/grouped?unread_only=${unread_only}&limit=${limit}`,
      { headers: { Authorization: token }, cache: "no-store" }
    );
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (error) {
    console.error("GET /api/notifications/grouped error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
