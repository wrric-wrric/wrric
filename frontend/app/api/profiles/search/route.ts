import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q') || searchParams.get('search');
        const type = searchParams.get('type');
        const limit = searchParams.get('limit') || '20';

        const cookieStore = await cookies();
        const token = cookieStore.get('token')?.value;

        if (!token || token === "null" || token === "undefined") {
            return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
        }

        let url = `${base}/api/profiles?limit=${limit}`;
        if (query) {
            url += `&search=${encodeURIComponent(query)}`;
        } else if (!type) {
            // Pass empty search so backend enters search branch (excludes current user)
            url += `&search=`;
        }
        if (type) {
            url += `&type=${type}`;
        }

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const data = await response.json();
        console.log(data);
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error("Profiles search error:", error);
        return NextResponse.json(
            { detail: "Internal server error" },
            { status: 500 }
        );
    }
}