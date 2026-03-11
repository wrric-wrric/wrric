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
    return fromCookie ? `Bearer ${fromCookie}` : null;
}

/**
 * PATCH /api/user-labs/[entityId]/images/[imageId]
 * Forward update to backend (caption, is_primary)
 * Body expected JSON: { caption?: string, is_primary?: boolean }
 */
export async function PATCH(request: NextRequest, { params }: { params: any }) {
  try {
    const { entityId, imageId } = await params;

    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!entityId || !imageId) {
      return NextResponse.json({ error: "Missing entityId or imageId" }, { status: 400 });
    }

    const body = await request.json();

    const response = await fetch(`${base}/api/user_entities/${entityId}/images/${imageId}`, {
      method: "PATCH",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.detail || "Failed to update image" },
        { status: response.status }
      );
    }

    const updated = await response.json();
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Image patch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/user-labs/[entityId]/images/[imageId]
 * Forward deletion to backend
 */
export async function DELETE(request: NextRequest, { params }: { params: any }) {
  try {
    const { entityId, imageId } = await params;

    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!entityId || !imageId) {
      return NextResponse.json({ error: "Missing entityId or imageId" }, { status: 400 });
    }

    const response = await fetch(`${base}/api/user_entities/${entityId}/images/${imageId}`, {
      method: "DELETE",
      headers: {
        Authorization: token,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.detail || "Failed to delete image" },
        { status: response.status }
      );
    }

    // backend returns message; forward that
    const payload = await response.json().catch(() => ({ message: "Deleted" }));
    return NextResponse.json(payload);
  } catch (err) {
    console.error("Image delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
