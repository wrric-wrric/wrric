// lib/api.ts
import { cookies } from 'next/headers';

export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000/api';

// API Error interface
export interface APIError {
  detail: string;
}

// Get auth token from cookies
export async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value;
}

// Set auth token in cookies
export async function setAuthToken(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('access_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 // 24 hours
  });
}

// Clear auth token
export async function clearAuthToken() {
  const cookieStore = await cookies();
  cookieStore.delete('access_token');
}

// Generic API request wrapper with error handling
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

    if (!response.ok) {
      const error: APIError = await response.json();

      // Handle specific error codes
      switch (response.status) {
        case 401:
          throw new Error('Unauthorized - Please login again');
        case 403:
          throw new Error('Forbidden - You do not have permission');
        case 404:
          throw new Error('Not found - The requested resource was not found');
        case 429:
          throw new Error('Too many requests - Please try again later');
        default:
          throw new Error(error.detail || 'An error occurred');
      }
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error - Please check your connection');
  }
}

// Authenticated API request wrapper
export async function authenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
}