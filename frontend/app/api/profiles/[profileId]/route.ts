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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ profileId: string; }> }
) {
  try {
    const token = await getAuthToken(req);

    if (!token) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const {profileId}  = await context.params;
    
    const response = await fetch(`${base}/api/profiles/${profileId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}


export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const body = await req.formData();
  
  const token = await getAuthToken(req);
  
  const response = await fetch(`${base}/api/profiles${url.pathname.replace("/api/profiles", "")}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}