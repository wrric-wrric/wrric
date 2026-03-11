import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

// GET /api/match_records/entities/[entityId] - Get match records for specific entity
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ entityId: string }> }
) {
  try {
    const session = await getCurrentUser(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entityId } = await context.params;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const minScore = searchParams.get('min_score');

    // Build query parameters for backend
    const queryParams = new URLSearchParams();
    if (status && status !== 'all') queryParams.append('status', status);
    if (minScore) queryParams.append('min_score', minScore);

    const backendUrl = `${base}/api/match_records/entities/${entityId}?${queryParams}`;
    
    const response = await fetch(backendUrl, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }

    const matchRecords = await response.json();
    return NextResponse.json(matchRecords);
  } catch (error) {
    console.error('GET entity match_records error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entity match records' },
      { status: 500 }
    );
  }
}