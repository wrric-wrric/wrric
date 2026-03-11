import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/providers`);

    if (!response.ok) {
      return NextResponse.json(
        { detail: "Failed to fetch OAuth providers" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Get OAuth providers error:", error);
    return NextResponse.json(
      { detail: "An error occurred while fetching OAuth providers" },
      { status: 500 }
    );
  }
}