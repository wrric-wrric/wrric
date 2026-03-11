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
 * POST /api/user-labs/[entityId]/images
 * Forward multipart/form-data to backend to upload images for entity
 */
export async function POST(request: NextRequest, { params }: { params: any }) {
  try {
    // Next.js requires awaiting params before using its properties
    const { entityId } = await params;

    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!entityId) {
      return NextResponse.json({ error: "Lab ID is required" }, { status: 400 });
    }

    // get formData from the incoming request
    const formData = await request.formData();

    // Forward to your FastAPI upload endpoint.
    // IMPORTANT: do NOT set Content-Type here — letting fetch set it ensures the multipart boundary is correct.
    const response = await fetch(`${base}/api/user_entities/${entityId}/images`, {
      method: "POST",
      headers: {
        Authorization: token, // already has "Bearer ..." or whatever the client passed
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.detail || "Failed to upload images" },
        { status: response.status }
      );
    }

    const images = await response.json();
    // backend returns created images (with presigned URLs). Return 201 (created).
    return NextResponse.json(images, { status: 201 });
  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/user-labs/[entityId]/images
 * Fetch the lab from backend and return its images array only.
 */
export async function GET(request: NextRequest, { params }: { params: any }) {
  try {
    const { entityId } = await params;

    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!entityId) {
      return NextResponse.json({ error: "Lab ID is required" }, { status: 400 });
    }

    const response = await fetch(`${base}/api/user_entities/${entityId}`, {
      method: "GET",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.detail || "Failed to fetch lab images" },
        { status: response.status }
      );
    }

    const lab = await response.json();
    console.log('lab', lab);
    return NextResponse.json(lab.images ?? []);
  } catch (err) {
    console.error("Images fetch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
