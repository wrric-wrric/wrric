import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { cleanToken } from "@/lib/auth-utils";

export interface UserSession {
  funderProfile: {
    id: string;
    name: string;
    email: string;
  };
  user: {
    id: string;
    username?: string;
    email?: string;
  };
  accessToken: string;
}

const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://192.168.246.236:8000";
// const base = "http://192.168.246.236:8000";

export async function getCurrentUser(request: NextRequest): Promise<UserSession | null> {
  try {
    // Get token from Authorization header or cookies
    const authHeader = request.headers.get('authorization');
    let token: string | null = cleanToken(authHeader);

    if (!token) {
      const cookieStore = await cookies();
      token = cleanToken(cookieStore.get('token')?.value);
    }

    if (!token) {
      return null;
    }

    // Verify token with backend
    const verifyUrl = `${base}/api/verify-token`;
    const response = await fetch(verifyUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const userData = await response.json();
    
    return {
      user: {
        id: userData.user_id,
        username: userData.username,
        email: userData.email,
      },
      funderProfile: userData.funder_profile,
      accessToken: token,
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}