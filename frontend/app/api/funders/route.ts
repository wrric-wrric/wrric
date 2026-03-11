// app/api/funders/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';
import { cleanToken } from "@/lib/auth-utils";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

async function getAuthToken(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get("Authorization");
    const fromHeader = cleanToken(authHeader);
    if (fromHeader) return `Bearer ${fromHeader}`;

    const cookieStore = await cookies();
    const fromCookie = cleanToken(cookieStore.get("token")?.value);
    return fromCookie ? `Bearer ${fromCookie}` : null;
}

export async function GET(req: NextRequest) {
    const auth = await getAuthToken(req);
    const url = new URL(req.url);
    const response = await fetch(`${base}/api/funders/`, {
        headers: { Authorization: auth || "" },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
}

export async function POST(req: NextRequest) {
    const auth = await getAuthToken(req);
    const body = await req.json();
    const response = await fetch(`${base}/api/funders/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: auth || "",
        },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
}