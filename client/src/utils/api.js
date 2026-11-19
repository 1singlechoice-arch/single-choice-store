export async function apiRequest(endpoint, options = {}) {
  const { token: explicitToken, headers: customHeaders, body, ...restOptions } = options;
  const token = explicitToken || localStorage.getItem('sc_token') || '';

  const headers = {
    ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(customHeaders || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const backendBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${backendBase}${normalizedEndpoint}`;

  const response = await fetch(url, {
    ...restOptions,
    body,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || data.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}