import { NextRequest, NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    const token = auth?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    
    const response = await fetch(`${base}/api/admin/events/stats/overview`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Stats fetch error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}