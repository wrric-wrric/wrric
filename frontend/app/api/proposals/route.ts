import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

// GET /api/proposals - Get all proposals for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentUser(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const entityId = searchParams.get('entity_id');

    // Build query parameters for backend
    const queryParams = new URLSearchParams();
    if (status && status !== 'all') queryParams.append('status', status);
    if (entityId) queryParams.append('entity_id', entityId);

    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.246.236:8000'}/api/proposals?${queryParams}`;
    
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
    console.error('GET proposals error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    );
  }
}

// POST /api/proposals - Create a new proposal
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentUser(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.246.236:8000'}/api/proposals`;
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Backend returned ${response.status}`);
    }

    const proposal = await response.json();
    return NextResponse.json(proposal, { status: 201 });
  } catch (error) {
    console.error('POST proposals error:', error);
    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    );
  }
}