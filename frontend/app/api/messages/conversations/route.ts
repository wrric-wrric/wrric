// app/api/messages/conversations/route.ts
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
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
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

    let data = await response.json();
    
    // Ensure data is an array
    if (!Array.isArray(data)) {
      data = [];
    }

    // Fetch actual profile names for each conversation
    const conversationsWithNames = await Promise.all(
      data.map(async (conv: any) => {
        try {
          const profileResponse = await fetch(`${base}/api/profiles/${conv.profile_id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          
          if (profileResponse.ok) {
            const profile = await profileResponse.json();
            // Use the actual profile display name instead of profile_type
            const displayName = profile.display_name || 
              [profile.first_name, profile.last_name].filter(Boolean).join(" ") || 
              "Unnamed Profile";
            
            return {
              ...conv,
              profile_name: displayName,
              profile_type: profile.type || conv.profile_type,
              profile_image: conv.profile_image || profile.profile_image || null,
            };
          }
        } catch (profileError) {
          console.error("Failed to fetch profile for conversation:", profileError);
        }
        return conv;
      })
    );

    return NextResponse.json(conversationsWithNames, { status: response.status });
  } catch (error) {
    console.error("Fetch conversations error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}