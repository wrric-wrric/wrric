import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/linkedin/login`);

    if (!response.ok) {
      return NextResponse.json(
        { detail: "Failed to initiate LinkedIn OAuth" },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.auth_url) {
      return NextResponse.redirect(data.auth_url);
    }

    return NextResponse.json(
      { detail: "No auth URL returned from backend" },
      { status: 500 }
    );
  } catch (error) {
    console.error("LinkedIn OAuth initiation error:", error);
    return NextResponse.json(
      { detail: "An error occurred while initiating LinkedIn OAuth" },
      { status: 500 }
    );
  }
}