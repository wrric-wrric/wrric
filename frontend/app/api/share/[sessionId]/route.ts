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

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await context.params;
        const auth = await getAuthToken(request);

        const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

        const response = await fetch(`${base}/api/share/${sessionId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: auth || "",
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("POST /api/share/[sessionId] error:", error);
        return NextResponse.json({ error: "Failed to share session" }, { status: 500 });
    }
}
