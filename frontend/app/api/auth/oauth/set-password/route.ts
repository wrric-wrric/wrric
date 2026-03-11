import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.password || !body.recaptchaResponse) {
      return NextResponse.json(
        { detail: "Password and reCAPTCHA response are required" },
        { status: 400 }
      );
    }

    if (body.password.length < 8) {
      return NextResponse.json(
        { detail: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/auth/oauth/set-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: body.password,
        recaptchaResponse: body.recaptchaResponse,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to set password" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      message: data.message || "Password set successfully!",
    });
  } catch (error) {
    console.error("OAuth set password error:", error);
    return NextResponse.json(
      { detail: "An error occurred while setting password" },
      { status: 500 }
    );
  }
}