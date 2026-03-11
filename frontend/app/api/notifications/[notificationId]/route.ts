import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

// DELETE /api/notifications/[id] - Delete specific notification
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ notificationId: string }> }
) {
  try {
    const session = await getCurrentUser(request);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {notificationId} = await context.params;
    
    const backendUrl = `${base}/api/notifications/${notificationId}`;
    
    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Backend returned ${response.status}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('DELETE notification error:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}