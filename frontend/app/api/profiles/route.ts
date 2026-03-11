import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cleanToken } from "@/lib/auth-utils";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

async function getAuthToken(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get("Authorization");
    const fromHeader = cleanToken(authHeader);
    if (fromHeader) return `Bearer ${fromHeader}`;

    const cookieStore = await cookies();
    const fromCookie = cleanToken(cookieStore.get("token")?.value);
    if (fromCookie) return `Bearer ${fromCookie}`;

    return null;
}

export async function GET(req: NextRequest) {
    try {
        const authToken = await getAuthToken(req);

        if (!authToken) {
            return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
        }

        const response = await fetch(`${base}/api/profiles`, {
            headers: {
                Authorization: authToken
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Profile fetch error:", error);
        return NextResponse.json(
            { detail: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const authToken = await getAuthToken(req);

        if (!authToken) {
            return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
        }

        const body = await req.formData();

        const response = await fetch(`${base}/api/profiles`, {
            method: "POST",
            headers: {
                Authorization: authToken
            },
            body,
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Profile creation error:", error);
        return NextResponse.json(
            { detail: "Internal server error" },
            { status: 500 }
        );
    }
}
