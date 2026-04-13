const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function backendFetch(path: string, options?: RequestInit) {
  const url = `${BACKEND_URL}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    });
    return res;
  } catch (error: any) {
    console.error(`Backend fetch error for ${path}:`, error?.message ?? error);
    throw error;
  }
}

export async function backendJson(path: string, options?: RequestInit) {
  const res = await backendFetch(path, options);
  if (!res?.ok) {
    const text = await res?.text?.().catch(() => 'Unknown error');
    throw new Error(text || `Request failed: ${res?.status}`);
  }
  return res.json();
}
