import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("Authorization") || "";
    if (!token) return NextResponse.json({ count: 0 });

    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";
    const res = await fetch(`${base}/api/notifications/unread-count`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
