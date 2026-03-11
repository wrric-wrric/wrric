import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

// GET /api/funders/proposals - Get proposals submitted to current funder
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Build query parameters for backend
    const queryParams = new URLSearchParams();
    if (status && status !== 'all') queryParams.append('status', status);
    if (search) queryParams.append('search', search);

    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.246.236:8000'}/api/funders/proposals?${queryParams}`;
    
    const response = await fetch(backendUrl, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }

    const proposals = await response.json();
    return NextResponse.json(proposals);
  } catch (error) {
    console.error('GET funder proposals error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch funder proposals' },
      { status: 500 }
    );
  }
}