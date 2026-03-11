// app/api/history/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { cleanToken } from "@/lib/auth-utils";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";
const FETCH_TIMEOUT_MS = 25_000;

async function getAuthToken(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get("Authorization");
    const fromHeader = cleanToken(authHeader);
    if (fromHeader) return `Bearer ${fromHeader}`;

    const cookieStore = await cookies();
    const fromCookie = cleanToken(cookieStore.get("token")?.value);
    return fromCookie ? `Bearer ${fromCookie}` : null;
}

async function fetchWithTimeout(resource: string, init: RequestInit = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(resource, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string; }> }
) {
  const { userId } = await context.params;

  if (!base) {
    return NextResponse.json({ detail: "Backend URL not configured" }, { status: 500 });
  }

  const auth = await getAuthToken(req);

  try {
    const backendRes = await fetchWithTimeout(`${base}/api/history/${userId}`, {
      method: "GET",
      headers: {
        Authorization: auth || "",
        Accept: "application/json, text/event-stream, application/x-ndjson, text/plain, */*",
      },
    });

    if (!backendRes) {
      return NextResponse.json({ detail: "No response from backend" }, { status: 502 });
    }

    const status = backendRes.status || 502;
    const forwardedHeaders: Record<string, string> = {};

    backendRes.headers.forEach((value, key) => {
      forwardedHeaders[key] = value;
    });

    if (backendRes.body) {
      return new NextResponse(backendRes.body, { status, headers: forwardedHeaders });
    }

    const text = await backendRes.text();

    if (!forwardedHeaders["content-type"]) {
      forwardedHeaders["content-type"] = "text/plain; charset=utf-8";
    }

    return new NextResponse(text, { status, headers: forwardedHeaders });

  } catch (err: any) {
    if (err?.name === "AbortError") {
      return NextResponse.json({ detail: "Backend request timed out" }, { status: 504 });
    }
    console.error("Proxy error fetching history:", err);
    return NextResponse.json({ detail: "Failed to contact backend" }, { status: 502 });
  }
}
