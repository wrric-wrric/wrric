import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// GET - View my registration
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
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/user-events/${eventIdentifier}/registrations/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get registration error:", error);
    return NextResponse.json(
      { detail: "Failed to fetch registration" },
      { status: 500 }
    );
  }
}

// PUT - Update my registration
export async function PUT(
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
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const response = await fetch(
      `${BACKEND_URL}/api/user-events/${eventIdentifier}/registrations/me`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Update registration error:", error);
    return NextResponse.json(
      { detail: "Failed to update registration" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel my registration
export async function DELETE(
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
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/user-events/${eventIdentifier}/registrations/me`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Cancel registration error:", error);
    return NextResponse.json(
      { detail: "Failed to cancel registration" },
      { status: 500 }
    );
  }
}
