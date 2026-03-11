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
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params = new URLSearchParams();

    // Add query parameters
    ['limit', 'page', 'is_published', 'is_featured', 'search']
      .forEach(param => {
        const value = searchParams.get(param);
        if (value) params.append(param, value);
      });

    const response = await fetch(`${base}/api/admin/events?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Admin events fetch error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getAuthToken(req);

    if (!token) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    // Handle multipart form data for image uploads
    const formData = await req.formData();

    const response = await fetch(`${base}/api/admin/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Backend error response:", {
        status: response.status,
        data,
      });
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Create event error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}