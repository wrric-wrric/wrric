import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

const base =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.246.236:8000';

// PUT /api/matches/[matchId]/status - Update match record status
export async function PUT(
  request: NextRequest,
  context: { params:  Promise<{ matchId: string }>  }
) {
  console.debug('🔧 [PUT /api/matches/[matchId]/status] Triggered');

  try {
    const session = await getCurrentUser(request);
    console.debug('🧠 Session data:', session ? '✅ Found' : '❌ None');

    if (!session) {
      console.warn('🚫 Unauthorized request — no session token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {matchId} = await context.params;
    
    console.debug('🆔 matchId param:', matchId);

    const body = await request.json();
    console.debug('📦 Request body:', body);

    const backendUrl = `${base}/api/match_records/${matchId}/status`;
    console.debug('🌐 Backend URL:', backendUrl);

    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.debug('📡 Backend responded with:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Backend error data:', errorData);
      throw new Error(JSON.stringify(errorData));
    }

    const result = await response.json();
    console.info('✅ Successfully updated match status:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('🔥 PUT match_record status error:', error);
    return NextResponse.json(
      { error: 'Failed to update match status', details: String(error) },
      { status: 500 }
    );
  }
}
