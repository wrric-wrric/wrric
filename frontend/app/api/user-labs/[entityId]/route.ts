import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cleanToken } from "@/lib/auth-utils";

const base =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.246.236:8000';

async function getAuthToken(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get("Authorization");
    const fromHeader = cleanToken(authHeader);
    if (fromHeader) return fromHeader;

    const cookieStore = await cookies();
    const fromCookie = cleanToken(cookieStore.get("token")?.value);
    return fromCookie;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> }

) {
  try {
    const token = await getAuthToken(request);

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { entityId } = await context.params;
    console.log("entity id", entityId)

    if (!entityId) {
      return NextResponse.json({ error: 'Lab ID is required' }, { status: 400 });
    }

    const response = await fetch(`${base}/api/user_entities/${entityId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Lab not found' }, { status: 404 });
      }

      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.detail || 'Failed to fetch lab' },
        { status: response.status }
      );
    }

    const lab = await response.json();

    if (lab.profile_id && !lab.profile) {
      try {
        const profileResponse = await fetch(`${base}/api/profiles/${lab.profile_id}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          lab.profile = profileData;
        }
      } catch (profileError) {
        console.error("Failed to fetch profile:", profileError);
      }
    }

    return NextResponse.json(lab);
  } catch (error) {
    console.error('Lab fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> }
) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { entityId } = await context.params;
    const body = await request.json();

    if (!entityId) {
      return NextResponse.json({ error: 'Lab ID is required' }, { status: 400 });
    }

    const response = await fetch(`${base}/api/user_entities/${entityId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Lab not found' }, { status: 404 });
      }

      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.detail || 'Failed to update lab' },
        { status: response.status }
      );
    }

    const lab = await response.json();
    return NextResponse.json(lab);
  } catch (error) {
    console.error('Lab update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> }
) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { entityId } = await context.params;

    if (!entityId) {
      return NextResponse.json({ error: 'Lab ID is required' }, { status: 400 });
    }

    const response = await fetch(`${base}/api/user_entities/${entityId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: 'Lab not found' }, { status: 404 });
      }

      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.detail || 'Failed to delete lab' },
        { status: response.status }
      );
    }

    return NextResponse.json({ message: 'Lab deleted successfully' });
  } catch (error) {
    console.error('Lab deletion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
