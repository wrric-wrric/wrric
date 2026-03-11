import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ lab: string }> }
) {
  try {
    // ✅ Await params before using
    const { lab } = await context.params;
    
    // Validate lab parameter - reject short/invalid IDs
    if (!lab || lab.length < 8) {
      return NextResponse.json({ 
        error: "Invalid lab ID format" 
      }, { status: 400 });
    }

    const token = await getAuthToken(request);

    const labProfileUrl = `${base}/api/labs/${lab}`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(labProfileUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const labData = await response.json();

    // If lab has a profile_id but no profile data, fetch the profile separately
    if (labData.profile_id && !labData.profile) {
      try {
        const profHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (token) profHeaders["Authorization"] = `Bearer ${token}`;
        const profileResponse = await fetch(`${base}/api/profiles/${labData.profile_id}`, {
          headers: profHeaders,
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          labData.profile = profileData;
        }
      } catch (profileError) {
        console.error("Failed to fetch profile:", profileError);
      }
    }

    return NextResponse.json(labData, { status: response.status });
  } catch (error) {
    console.error("GET /api/labs/[lab] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lab" },
      { status: 500 }
    );
  }
}
