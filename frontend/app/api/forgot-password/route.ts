import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ForgotPasswordRequest {
  email: string;
  recaptchaResponse: string;
}

export async function POST(request: Request) {
  try {
    const body: ForgotPasswordRequest = await request.json();

    if (!body.email || !body.recaptchaResponse) {
      return NextResponse.json(
        { detail: "Email and reCAPTCHA response are required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: body.email.toLowerCase(),
        recaptchaResponse: body.recaptchaResponse,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to send reset email" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      message: data.message || "Password reset link sent to your email!",
      email_sent: data.email_sent || true,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { detail: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}