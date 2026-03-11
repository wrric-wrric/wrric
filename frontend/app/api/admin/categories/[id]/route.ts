import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function handleRequest(
  req: NextRequest,
  method: string,
  context: { params: Promise<{ id: string; }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const url = `${base}/api/admin/categories/${id}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    };

    if (method === 'PUT') {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
      };
      options.body = JSON.stringify(await req.json());
    }

    const response = await fetch(url, options);
    const data = await response.json();
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`${method} category error:`, error);
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