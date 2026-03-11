import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";
    const limit = searchParams.get("limit") || "20";
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { detail: "Event ID is required" },
        { status: 400 }
      );
    }

    const auth = request.headers.get("authorization");
    const token = auth?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
    }

    const queryParams = new URLSearchParams({
      page,
      limit,
    });

    if (search) queryParams.append("search", search);
    if (status) queryParams.append("status", status);

    const response = await fetch(
      `${BACKEND_URL}/api/admin/events/${id}/registrations?${queryParams.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to fetch registrations" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Get event registrations error:", error);
    return NextResponse.json(
      { detail: "An error occurred while fetching registrations" },
      { status: 500 }
    );
  }
}
