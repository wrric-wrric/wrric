// app/api/messages/unread-count/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cleanToken } from "@/lib/auth-utils";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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
      return NextResponse.json({ total_unread: 0 }, { status: 200 });
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("profile_id");

    let url = `${base}/api/messages/conversations`;
    if (profileId) {
      url += `?profile_id=${profileId}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ total_unread: 0 }, { status: 200 });
    }

    let data = await response.json();
    
    if (!Array.isArray(data)) {
      data = [];
    }

    const totalUnread = data.reduce((acc: number, conv: any) => {
      return acc + (conv.unread_count || 0);
    }, 0);

    return NextResponse.json({ total_unread: totalUnread }, { status: 200 });
  } catch (error) {
    console.error("Fetch unread count error:", error);
    return NextResponse.json({ total_unread: 0 }, { status: 200 });
  }
}
