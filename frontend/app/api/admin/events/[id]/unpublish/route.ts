import { NextRequest, NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; }> }
) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    const token = auth.replace("Bearer ", "");

    const { id } = await context.params;
    
    const response = await fetch(`${base}/api/admin/events/${id}/unpublish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Unpublish event error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}