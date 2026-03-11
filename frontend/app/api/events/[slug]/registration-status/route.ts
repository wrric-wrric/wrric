import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    // slug parameter can be either slug or UUID - backend expects UUID for registration endpoints
    const eventIdentifier = slug;
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { registered: false, registration_id: null, status: null, available_actions: [], registration: null },
        { status: 200 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/user-events/${eventIdentifier}/registration-status`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { registered: false, registration_id: null, status: null, available_actions: [], registration: null },
          { status: 200 }
        );
      }
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Registration status check error:", error);
    return NextResponse.json(
      { detail: "Failed to check registration status" },
      { status: 500 }
    );
  }
}
