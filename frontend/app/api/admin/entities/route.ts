import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params = new URLSearchParams();
    
    ['page', 'page_size', 'search', 'entity_type', 'source', 'sort_by', 'sort_order']
      .forEach(param => {
        const value = searchParams.get(param);
        if (value) params.append(param, value);
      });
    
    const response = await fetch(`${base}/api/admin/entities?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Admin entities fetch error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}
