// app/api/messages/conversation/[conversationId]/read/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(
  req: NextRequest, 
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await context.params;
    
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    // Get profile_id from search params
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("profile_id");

    // Build URL with profile_id if provided
    let url = `${base}/api/messages/conversation/${conversationId}/read`;
    if (profileId) {
      url += `?profile_id=${profileId}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Mark conversation as read error:", error);
    return NextResponse.json({ detail: "Internal server error" }, { status: 500 });
  }
}