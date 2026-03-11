import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cleanToken } from "@/lib/auth-utils";

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

async function getAuthToken(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get("Authorization");
    const fromHeader = cleanToken(authHeader);
    if (fromHeader) return fromHeader;

    const cookieStore = await cookies();
    const fromCookie = cleanToken(cookieStore.get("token")?.value);
    return fromCookie;
}

async function fetchProfileForLab(token: string, profileId: string | null): Promise<any | null> {
    if (!profileId) return null;
    
    try {
        const profileResponse = await fetch(`${base}/api/profiles/${profileId}`, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        if (profileResponse.ok) {
            return await profileResponse.json();
        }
    } catch (profileError) {
        console.error("Failed to fetch profile:", profileError);
    }
    return null;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken(request);

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const skip = searchParams.get('skip') || '0';
    const limit = searchParams.get('limit') || '50';

    // Forward request to your FastAPI backend
    const response = await fetch(`${base}/api/user_entities/?skip=${skip}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.detail || 'Failed to fetch labs' },
        { status: response.status }
      );
    }

    let labs = await response.json();

    // Ensure labs is an array
    if (!Array.isArray(labs)) {
      labs = [];
    }

    // Fetch profiles for labs that have profile_id but no profile data
    const labsWithProfiles = await Promise.all(
      labs.map(async (lab: any) => {
        if (lab.profile_id && !lab.profile) {
          const profile = await fetchProfileForLab(token, lab.profile_id);
          if (profile) {
            lab.profile = profile;
          }
        }
        return lab;
      })
    );

    return NextResponse.json(labsWithProfiles);
  } catch (error) {
    console.error('Labs fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.university || !body.research_abstract) {
      return NextResponse.json(
        { error: 'University and research abstract are required' },
        { status: 400 }
      );
    }

    // Forward request to your FastAPI backend
    const response = await fetch(`${base}/api/user_entities/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);

      if (response.status === 409) {
        return NextResponse.json(
          { error: 'A lab with this URL already exists' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: errorData?.detail || 'Failed to create lab' },
        { status: response.status }
      );
    }

    const lab = await response.json();
    return NextResponse.json(lab, { status: 201 });
  } catch (error) {
    console.error('Lab creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}