import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

// GET /api/match_records/funders/matches - Get matches for current funder
export async function GET(request: NextRequest) {
  console.debug("🛰️ [API] Incoming request: /api/match_records/funders/matches");

  try {
    // Step 1: Validate session
    const session = await getCurrentUser(request);
    console.debug("🧭 Session lookup complete:", session ? "✅ Found" : "❌ Not found");

    if (!session) {
      console.warn("⚠️ Unauthorized attempt to fetch funder matches.");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user?.id || "(no user id)";
    const funderId = session.funderProfile?.id || "(no funder id)";
    console.debug(`👤 Authenticated user_id=${userId}, funder_id=${funderId}`);

    // Step 2: Extract search params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const minScore = searchParams.get('min_score');
    const search = searchParams.get('search');

    console.debug("🔍 Query parameters received:", {
      status,
      minScore,
      search,
    });

    // Step 3: Build query string for backend
    const queryParams = new URLSearchParams();
    if (status && status !== 'all') queryParams.append('status', status);
    if (minScore) queryParams.append('min_score', minScore);
    if (search) queryParams.append('search', search);

    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.246.236:8000';
    const backendUrl = `${baseUrl}/api/match_records/funders/matches?${queryParams.toString()}`;

    console.debug("🌍 Backend endpoint:", backendUrl);
    console.debug("🔐 Using access token (first 10 chars):", session.accessToken?.slice(0, 10) || "None");

    // Step 4: Send request to backend
    const response = await fetch(backendUrl, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.debug(`📡 Backend responded with ${response.status}: ${response.statusText}`);

    // Step 5: Handle backend response
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("❌ Backend error response:", errorData);
      throw new Error(
        `Backend returned ${response.status}: ${response.statusText} — ${JSON.stringify(errorData)}`
      );
    }

    const matches = await response.json();
    console.info(`✅ Successfully retrieved ${matches?.length || 0} matches for funder_id=${funderId}`);

    return NextResponse.json(matches);

  } catch (error: any) {
    console.error("🚨 [GET /api/match_records/funders/matches] Unexpected error:", error?.message || error);
    return NextResponse.json(
      { error: 'Failed to fetch funder matches', details: error?.message || error },
      { status: 500 }
    );
  }
}
