import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, new_password } = body;

    if (!token) {
      return NextResponse.json(
        { detail: "Token is required" },
        { status: 400 }
      );
    }

    if (!new_password || new_password.length < 8) {
      return NextResponse.json(
        { detail: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/complete-registration`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to complete registration" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Complete registration error:", error);
    return NextResponse.json(
      { detail: "An error occurred while completing registration" },
      { status: 500 }
    );
  }
}
