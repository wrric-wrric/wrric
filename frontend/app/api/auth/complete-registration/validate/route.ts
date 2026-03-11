import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, detail: "Token is required" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/complete-registration/validate?token=${encodeURIComponent(token)}`
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { valid: false, detail: data.detail || "Invalid or expired token" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Complete registration validation error:", error);
    return NextResponse.json(
      { valid: false, detail: "Failed to validate token" },
      { status: 500 }
    );
  }
}
