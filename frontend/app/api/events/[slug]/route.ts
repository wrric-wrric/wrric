import { NextRequest, NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string; }> }
) {
  try {
    const { slug } = await context.params;
    
    const response = await fetch(`${base}/api/events/${slug}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Event fetch error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}