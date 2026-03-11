import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface TokenValidationResponse {
  valid: boolean;
  message: string;
  email?: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json<TokenValidationResponse>(
        { valid: false, message: "Token is required" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/reset-password/validate?token=${token}`
    );

    const data: TokenValidationResponse = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { valid: false, message: data.message || "Invalid or expired token" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { valid: false, message: "An error occurred while validating token" },
      { status: 500 }
    );
  }
}