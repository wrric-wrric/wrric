export async function checkAdminAccess(): Promise<boolean> {
  try {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[checkAdminAccess] No token found');
      }
      return false;
    }

    const response = await fetch('/api/admin/check-access', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',  // Prevent caching
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('[checkAdminAccess] Response status:', response.status, 'ok:', response.ok);
    }
    
    // Only return true if we get a 200 OK response
    if (response.status === 200) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Admin access check failed:', error);
    return false;
  }
}

export async function getCurrentUser() {
  try {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}