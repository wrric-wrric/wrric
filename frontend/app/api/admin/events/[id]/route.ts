import { NextRequest, NextResponse } from "next/server";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function handleRequest(
  req: NextRequest,
  method: string,
  context: { params: Promise<{ id: string; }> }
) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    const token = auth.replace("Bearer ", "");

    const { id } = await context.params;
    const url = `${base}/api/admin/events/${id}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    };

    if (method === 'PUT') {
      // Handle FormData for updates (images upload)
      const formData = await req.formData();
      // options.body = formData; // Don't set Content-Type header - browser handles it for FormData

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Backend PUT error response:", {
          id,
          status: response.status,
          data,
        });
      }

      return NextResponse.json(data, { status: response.status });
    }

    // For GET and DELETE methods, or if PUT logic above doesn't return
    const response = await fetch(url, options);
    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`${method} event error:`, error);
    return NextResponse.json(
      { detail: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; }> }
) {
  return handleRequest(req, 'GET', context);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; }> }
) {
  return handleRequest(req, 'PUT', context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; }> }
) {
  return handleRequest(req, 'DELETE', context);
}