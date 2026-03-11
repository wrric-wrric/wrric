// app/api/messages/conversation/[conversationId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "50";
    const offset = searchParams.get("offset") || "0";
    const profileId = searchParams.get("profile_id"); // Get profile_id

    console.log("Fetching conversation:", conversationId, "profile:", profileId, "limit:", limit, "offset:", offset);

    // Check Authorization header first, then fall back to cookie
    const authHeader = req.headers.get("authorization");
    let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      const cookieStore = await cookies();
      const cookieToken = cookieStore.get("token")?.value;
      token = (cookieToken && cookieToken !== "null" && cookieToken !== "undefined") ? cookieToken : null;
    }

    if (!token) {
      console.warn("No token found in header or cookies");
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    // Build URL with profile_id if provided
    let url = `${base}/api/messages/conversation/${conversationId}?limit=${limit}&offset=${offset}`;
    if (profileId) {
      url += `&profile_id=${profileId}`;
    }

    console.log("Proxying request to backend:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    console.log("Backend responded with status:", response.status);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Messages fetch error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}