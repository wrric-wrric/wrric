import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ lab: string }> }
) {
  try {
    const { lab } = await context.params;
    
    // Validate lab parameter
    if (!lab || lab.length < 8) {
      return NextResponse.json({ error: "Invalid lab ID" }, { status: 400 });
    }
    
    const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "6";

    const response = await fetch(`${base}/api/labs/${lab}/related?limit=${limit}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("GET /api/labs/[lab]/related: Non-JSON response from backend");
      return NextResponse.json({ related_labs: [] }, { status: 200 });
    }

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("GET /api/labs/[lab]/related error:", error);
    return NextResponse.json({ 
      error: "Failed to fetch related labs",
      related_labs: [] 
    }, { status: 500 });
  }
}
