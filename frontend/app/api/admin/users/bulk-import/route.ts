import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ detail: "No file provided" }, { status: 400 });
    }

    // Validate file type and size
    if (file.type !== 'text/csv') {
      return NextResponse.json({ detail: "Only CSV files are allowed" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      return NextResponse.json({ detail: "File size exceeds 10MB limit" }, { status: 400 });
    }

    // Create new FormData to forward to backend
    const backendFormData = new FormData();
    backendFormData.append('file', file);

    const response = await fetch(`${base}/api/admin/users/bulk-import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: backendFormData,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}