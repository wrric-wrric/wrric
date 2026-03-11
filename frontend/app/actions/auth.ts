'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function login(formData: FormData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password'),
        recaptchaResponse: formData.get('recaptchaResponse')
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Store token in cookies (httpOnly for security)
      const cookieStore = await cookies();
      cookieStore.set('access_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 // 24 hours
      });
      cookieStore.set('user_id', data.user_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24
      });

      return { success: true, user_id: data.user_id };
    }

    return { success: false, error: data.detail };
  } catch (error) {
    return { success: false, error: 'Login failed' };
  }
}

export async function signup(formData: FormData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        recaptchaResponse: formData.get('recaptchaResponse')
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Store token in cookies (httpOnly for security)
      const cookieStore = await cookies();
      cookieStore.set('access_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 // 24 hours
      });
      cookieStore.set('user_id', data.user_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24
      });

      return { success: true, user_id: data.user_id };
    }

    return { success: false, error: data.detail };
  } catch (error) {
    return { success: false, error: 'Signup failed' };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('access_token');
  cookieStore.delete('user_id');
  redirect('/login');
}