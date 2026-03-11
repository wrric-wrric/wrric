import { NextRequest, NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await context.params;
    const token = req.headers.get("Authorization") || "";

    const response = await fetch(`${base}/api/users/${userId}/summary`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      cache: "no-store",
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("GET /api/users/[userId]/summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user summary" },
      { status: 500 }
    );
  }
}
