import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const { registrationId } = await params;
    const body = await request.json();

    if (!registrationId || !body.status) {
      return NextResponse.json(
        { detail: "Registration ID and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["pending", "confirmed", "cancelled", "waitlisted"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { detail: "Invalid status. Must be one of: pending, confirmed, cancelled, waitlisted" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/admin/events/registrations/${registrationId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: body.status,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { detail: data.detail || "Failed to update registration status" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Update registration status error:", error);
    return NextResponse.json(
      { detail: "An error occurred while updating registration" },
      { status: 500 }
    );
  }
}