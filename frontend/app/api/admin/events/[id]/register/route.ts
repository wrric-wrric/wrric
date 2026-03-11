import { NextRequest, NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const auth = req.headers.get("authorization");
        if (!auth) {
            return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
        }
        const token = auth.replace("Bearer ", "");

        const { id } = await context.params;
        const url = `${base}/api/admin/events/${id}/register`;

        // Handle FormData for registration (includes metadata and image if any)
        const formData = await req.formData();

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Backend register error response:", {
                id,
                status: response.status,
                data,
            });
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Manual registration error:", error);
        return NextResponse.json(
            { detail: "Internal server error" },
            { status: 500 }
        );
    }
}
