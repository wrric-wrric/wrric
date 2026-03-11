import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ lab: string }> }
) {
  try {
    const { lab } = await context.params;
    
    // Validate lab parameter to prevent invalid UUIDs
    if (!lab || lab.length < 8) {
      return NextResponse.json({ error: "Invalid lab ID" }, { status: 400 });
    }
    
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const auth = request.headers.get("authorization");
    if (auth) headers["Authorization"] = auth;

    const res = await fetch(`${BACKEND_URL}/api/labs/${lab}/likes`, { headers });
    
    // Check if response is JSON before parsing
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("GET /api/labs/[lab]/likes: Non-JSON response from backend");
      return NextResponse.json({ 
        error: "Backend returned invalid response",
        count: 0,
        liked: false 
      }, { status: res.ok ? 200 : 500 });
    }
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("GET /api/labs/[lab]/likes error:", error);
    return NextResponse.json({ 
      error: "Failed to get likes",
      count: 0,
      liked: false 
    }, { status: 500 });
  }
}
