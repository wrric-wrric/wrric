import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    const params = new URLSearchParams();
    
    // Add all query parameters
    ['limit', 'page', 'featured', 'location_type', 'from_date', 'sort_by', 'sort_order']
      .forEach(param => {
        const value = searchParams.get(param);
        if (value && value !== 'all') params.append(param, value);
      });
    
    // Handle category_ids array
    const categoryIds = searchParams.getAll('category_ids[]');
    categoryIds.forEach(id => params.append('category_ids', id));
    
    const response = await fetch(`${base}/api/events/upcoming?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Events fetch error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}