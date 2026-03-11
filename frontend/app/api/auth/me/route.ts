import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cleanToken } from "@/lib/auth-utils";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

async function getAuthToken(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get("Authorization");
    const fromHeader = cleanToken(authHeader);
    if (fromHeader) return fromHeader;

    const cookieStore = await cookies();
    const fromCookie = cleanToken(cookieStore.get("token")?.value);
    return fromCookie;
}

export async function GET(req: NextRequest) {
  try {
    const token = await getAuthToken(req);

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const response = await fetch(`${base}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ user: null }, { status: response.status });
    }

    const user = await response.json();
    return NextResponse.json(user, { status: 200 });

  } catch (error) {
    console.error("getCurrentUser error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
