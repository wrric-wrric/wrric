import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { cleanToken } from "@/lib/auth-utils";

async function getAuthToken(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get("Authorization");
    const fromHeader = cleanToken(authHeader);
    if (fromHeader) return `Bearer ${fromHeader}`;

    const cookieStore = await cookies();
    const fromCookie = cleanToken(cookieStore.get("token")?.value);
    return fromCookie ? `Bearer ${fromCookie}` : null;
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ userId: string; sessionId: string }> }
) {
    try {
        const { userId, sessionId } = await context.params;
        const auth = await getAuthToken(request);

        const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";
  
        const response = await fetch(`${base}/api/history/${userId}/${sessionId}`, {
            method: "DELETE",
            headers: { Authorization: auth || "" },
        });

        const result = await response.json();
        return NextResponse.json(result, { status: response.status });
    } catch (error) {
        console.error("DELETE /api/history/[userId]/[sessionId] error:", error);
        return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
    }
}
