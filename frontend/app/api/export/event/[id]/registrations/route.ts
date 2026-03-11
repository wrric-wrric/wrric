import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";
    const limit = searchParams.get("limit") || "100";
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

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
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { detail: error.detail || "Failed to fetch registrations" },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json(
        { detail: "No registrations found" },
        { status: 404 }
      );
    }

    const csvHeaders = [
      "First Name",
      "Last Name",
      "Email",
      "Position",
      "Organization",
      "Participation Type",
      "Attendance Type",
      "Ticket Type",
      "Wants Profile Visible",
      "Profile Visibility Types",
      "Special Requirements",
      "Status",
      "Registration Date",
      "Checked In At"
    ];

    const csvRows = data.items.map((reg: any) => {
      return [
      reg.first_name,
      reg.last_name,
      reg.email,
      reg.position || "",
      reg.organization || "",
      reg.participation_type,
      reg.attendance_type,
      reg.ticket_type || "",
      reg.wants_profile_visible,
      JSON.stringify(reg.profile_visibility_types),
      reg.special_requirements || "",
      reg.status,
      reg.registration_date,
      reg.checked_in_at || ""
    ];
    });

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row: any[]) =>
        row.map((cell: any) => {
          const cellStr = String(cell);
          if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const filename = `event-${id}-registrations-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export registrations error:", error);
    return NextResponse.json(
      { detail: "An error occurred while exporting registrations" },
      { status: 500 }
    );
  }
}
