import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    // slug parameter can be either slug or UUID - backend expects UUID for registration endpoints
    const eventIdentifier = slug;
    const { searchParams } = new URL(request.url);
    
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("page_size") || "50";

    const response = await fetch(
      `${BACKEND_URL}/api/user-events/${eventIdentifier}/participants?page=${page}&page_size=${pageSize}`
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get participants error:", error);
    return NextResponse.json(
      { detail: "Failed to fetch participants" },
      { status: 500 }
    );
  }
}
