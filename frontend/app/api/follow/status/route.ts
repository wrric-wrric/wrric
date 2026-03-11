import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get('target_id');
    
    // Validate target_id to prevent undefined or invalid values
    if (!targetId || targetId === 'undefined' || targetId.length < 8) {
      return NextResponse.json({ 
        error: "Invalid or missing target_id",
        is_following: false,
        follower_count: 0
      }, { status: 400 });
    }
    
    const query = searchParams.toString();
    const res = await fetch(`${BACKEND_URL}/api/follow/status${query ? `?${query}` : ""}`, {
      headers: { "Content-Type": "application/json" },
    });
    
    // Check if response is JSON
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json({ 
        is_following: false,
        follower_count: 0
      }, { status: 200 });
    }
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("GET /api/follow/status error:", error);
    return NextResponse.json({ 
      error: "Failed to get follow status",
      is_following: false,
      follower_count: 0
    }, { status: 500 });
  }
}
