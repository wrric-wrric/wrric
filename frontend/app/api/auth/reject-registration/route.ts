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
      `${BACKEND_URL}/api/reject-registration?token=${encodeURIComponent(token)}`
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
    console.error("Reject registration validation error:", error);
    return NextResponse.json(
      { valid: false, detail: "Failed to validate token" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const token = formData.get("token");

    if (!token) {
      return NextResponse.json(
        { detail: "Token is required" },
        { status: 400 }
      );
    }

    const backendFormData = new FormData();
    backendFormData.append("token", token as string);
    
    console.log('backendFormData:', backendFormData)
    const response = await fetch(
      `${BACKEND_URL}/api/reject-registration`,
      {
        method: "POST",
        body: backendFormData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to reject registration" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Reject registration error:", error);
    return NextResponse.json(
      { detail: "An error occurred while rejecting registration" },
      { status: 500 }
    );
  }
}
