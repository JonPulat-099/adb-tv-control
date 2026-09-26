export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Сервер недоступен');
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) window.dispatchEvent(new Event('auth:expired'));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

// Binary GET (e.g. screenshots) — returns a Blob; errors behave like api().
export async function apiBlob(path) {
  const token = localStorage.getItem('token');
  let res;
  try {
    res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new Error('Сервер недоступен');
  }
  if (res.status === 401 && token) window.dispatchEvent(new Event('auth:expired'));
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Ошибка ${res.status}`);
  }
  return res.blob();
}
