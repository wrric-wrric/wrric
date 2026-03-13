import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

const loginUrl = `${base}/api/login`;

export async function POST(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://backend:8000";
  const loginUrl = `${base}/api/login`;
  console.log("Backend URL:", loginUrl);

  try {
    const { username, email, password, recaptchaResponse } = await req.json();

    // Validate required fields (reCAPTCHA is optional for local development)
    if (!password) {
      return NextResponse.json(
        { detail: "Password is required" },
        { status: 422 },
      );
    }

    // Ensure only one of username or email is provided
    if (!username && !email) {
      return NextResponse.json(
        { detail: "Either username or email is required" },
        { status: 422 },
      );
    }

    if (username && email) {
      return NextResponse.json(
        { detail: "Provide either username or email, not both" },
        { status: 422 },
      );
    }

    // Prepare data with only the correct fields
    const data: Record<string, string> = {
      password,
      recaptchaResponse,
    };

    // Add either username or email, not both
    if (username) {
      data.username = username;
    } else {
      data.email = email;
    }

    console.log("Sending to backend:", data);

    const response = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const json = await response.json();
    console.log("response from login route: ", json);

    if (response.ok && json.access_token) {
      // Set HTTP-only cookie for server-side access
      const cookieStore = await cookies();
      cookieStore.set('token', json.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });

      // Also set user ID for easy access
      if (json.user_id) {
        cookieStore.set('user_id', json.user_id, {
          httpOnly: false, // Allow client-side access
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60,
          path: '/',
        });
      }
    }

    // Return the same status code as the backend
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.log("error: ", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { detail: "Internal server error: " + errMsg },
      { status: 500 },
    );
  }
}
















