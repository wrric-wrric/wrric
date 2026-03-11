import { NextRequest } from 'next/server';

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";

export const authConfig = {
  backendUrl: base,
  session: {
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  }
};

export interface Session {
  user: {
    id: string;
    username?: string;
    email?: string;
  };
  accessToken: string;
  expires: string;
}

export async function getServerSession(request: NextRequest): Promise<Session | null> {
  try {
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      const cookieHeader = request.headers.get('cookie');
      if (cookieHeader) {
        const cookies = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
        token = cookies.token || cookies.access_token;
      }
    }

    if (!token) return null;

    const verifyUrl = `${authConfig.backendUrl}/api/verify-token`;
    const response = await fetch(verifyUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const userData = await response.json();

    return {
      user: {
        id: userData.user_id,
        username: userData.username,
        email: userData.email,
      },
      accessToken: token,
      expires: new Date(Date.now() + authConfig.session.maxAge * 1000).toISOString(),
    };
  } catch (error) {
    console.error('Session verification error:', error);
    return null;
  }
}
