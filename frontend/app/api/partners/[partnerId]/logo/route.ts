import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    const { partnerId } = await params;
    const token = request.headers.get("authorization") || "";
    
    // Get the form data with file
    const formData = await request.formData();
    
    // Forward to backend
    const res = await fetch(`${BACKEND_URL}/api/partners/${partnerId}/logo`, {
      method: "POST",
      headers: { Authorization: token },
      body: formData,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Partner logo upload error:", error);
    return NextResponse.json(
      { detail: "Failed to upload logo" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    const { partnerId } = await params;
    const token = request.headers.get("authorization") || "";
    
    const res = await fetch(`${BACKEND_URL}/api/partners/${partnerId}/logo`, {
      method: "DELETE",
      headers: { Authorization: token },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Partner logo delete error:", error);
    return NextResponse.json(
      { detail: "Failed to delete logo" },
      { status: 500 }
    );
  }
}
