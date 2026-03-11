// app/api/messages/[messageId]/read/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ messageId: string }> }
) {
    try {
        const { messageId } = await context.params;
        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token) {
            return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
        }

        // No profile_id needed for this endpoint
        const response = await fetch(`${base}/api/messages/${messageId}/read`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Mark as read error:", error);
        return NextResponse.json(
            { detail: "Internal server error" },
            { status: 500 }
        );
    }
}