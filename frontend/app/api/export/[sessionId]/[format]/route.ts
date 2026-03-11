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

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ sessionId: string; format: string }> }
) {
    try {
        const { sessionId, format } = await context.params;
        const auth = await getAuthToken(request);

        const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

        const response = await fetch(`${base}/api/export/${sessionId}/${format}`, {
            headers: { Authorization: auth || "" },
        });

        const blob = await response.blob();

        return new NextResponse(blob, {
            status: response.status,
            headers: {
                "Content-Type":
                    format === "excel"
                        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        : "text/csv",
                "Content-Disposition": `attachment; filename=session_${sessionId}.${format === "excel" ? "xlsx" : "csv"}`,
            },
        });
    } catch (error) {
        console.error("GET /api/export/[sessionId]/[format] error:", error);
        return NextResponse.json({ error: "Failed to export session" }, { status: 500 });
    }
}
