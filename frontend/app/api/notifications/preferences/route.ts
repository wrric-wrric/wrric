import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("Authorization") || "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";
    const res = await fetch(`${base}/api/notifications/preferences`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const token = request.headers.get("Authorization") || "";
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";
    const body = await request.json();
    const res = await fetch(`${base}/api/notifications/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
