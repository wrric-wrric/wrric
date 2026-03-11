import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

// PUT /api/proposals/[id]/status - Update proposal status
export async function PUT(
  request: NextRequest,
  context : { params: Promise<{ proposalId: string }> }
) {
  try {
    const session = await getCurrentUser(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {proposalId} = await context.params;
    const body = await request.json();
    
    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://192.168.246.236:8000'}/api/proposals/${proposalId}/status`;
    
    const response = await fetch(backendUrl, {
      method: 'PUT',
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

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('PUT proposal status error:', error);
    return NextResponse.json(
      { error: 'Failed to update proposal status' },
      { status: 500 }
    );
  }
}