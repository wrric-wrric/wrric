import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ResetPasswordRequest {
  token: string;
  new_password: string;
  recaptchaResponse: string;
}

export async function POST(request: Request) {
  try {
    const body: ResetPasswordRequest = await request.json();

    if (!body.token || !body.new_password || !body.recaptchaResponse) {
      return NextResponse.json(
        { detail: "Token, new password, and reCAPTCHA response are required" },
        { status: 400 }
      );
    }

    if (body.new_password.length < 8) {
      return NextResponse.json(
        { detail: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: body.token,
        new_password: body.new_password,
        recaptchaResponse: body.recaptchaResponse,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to reset password" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      message: data.message || "Password reset successfully!",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { detail: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}