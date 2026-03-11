import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const formData = await request.formData();
    const { slug } = await params;
    
    // Get event_id from formData
    const eventId = formData.get('event_id');

    // DEBUG: Print all formData entries
    console.log("=== EVENT REGISTRATION DEBUG ===");
    console.log("Slug from URL:", slug);
    console.log("Event ID from formData:", eventId);
    console.log("\nAll FormData entries:");
    for (const [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value);
    }
    console.log("=== END DEBUG ===\n");

    if (!eventId) {
      return NextResponse.json(
        { detail: "Event ID is required" },
        { status: 400 }
      );
    }

    console.log(`Sending POST to: ${BACKEND_URL}/api/admin/events/${eventId}/register`);

    const response = await fetch(
      `${BACKEND_URL}/api/admin/events/${eventId}/register`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    // DEBUG: Log backend response
    console.log("\n=== BACKEND RESPONSE ===");
    console.log("Status:", response.status);
    console.log("Response data:", JSON.stringify(data, null, 2));
    console.log("=== END RESPONSE ===\n");

    if (!response.ok) {
      console.error("Registration failed with status:", response.status);
      console.error("Error details:", data);
      return NextResponse.json(
        { detail: data.detail || "Registration failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Event registration error:", error);
    return NextResponse.json(
      { detail: "An error occurred while processing your registration" },
      { status: 500 }
    );
  }
}