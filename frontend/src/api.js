const API_URL = import.meta.env.VITE_API_URL;

async function fetchWithAuth(url, options = {}, retry = true) {
  const token = localStorage.getItem('token');
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include', // Needed for refresh token cookie
  });

  if (response.status === 401 && retry) {
    // Try to refresh the token
    const refreshRes = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    const refreshData = await refreshRes.json();
    if (refreshData.success && refreshData.token) {
      localStorage.setItem('token', refreshData.token);
      // Retry original request with new token
      return fetchWithAuth(url, options, false);
    } else {
      // Refresh failed, force logout
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
  }

  return response;
}

export default fetchWithAuth;