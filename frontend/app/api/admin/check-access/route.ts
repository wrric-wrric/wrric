import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';
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
      return NextResponse.json({ detail: "Unauthorized", hasAccess: false }, { status: 401 });
    }

    // Check if user has admin access using the dedicated check-access endpoint
    const response = await fetch(`${base}/api/admin/check-access`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log('[Frontend API] Admin check-access response:', response.status);

    if (response.ok) {
      return NextResponse.json({ hasAccess: true }, { status: 200 });
    } else {
      return NextResponse.json({ hasAccess: false }, { status: 403 });
    }
  } catch (error) {
    console.error("Admin access check error:", error);
    return NextResponse.json({ hasAccess: false }, { status: 500 });
  }
}