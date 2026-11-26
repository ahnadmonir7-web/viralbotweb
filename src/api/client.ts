let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

const RAW_API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (RAW_API_BASE) {
    return `${RAW_API_BASE}${normalizedPath}`;
  }
  return `/api${normalizedPath}`;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(resolveApiUrl(path), {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let data: unknown = {};

  const looksLikeHtml =
    contentType.includes('text/html') || /^\s*<!doctype\s+html/i.test(text) || /^\s*<html/i.test(text);

  if (looksLikeHtml) {
    throw new Error(
      'Backend API (/api) is not connected on this host. If deploying the frontend on Cloudflare Pages, set VITE_API_URL to your PHP/Node backend API URL, or host the full PHP/MySQL package on cPanel.'
    );
  }

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Unexpected response format' };
  }

  if (!response.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new Error(msg);
  }

  return data as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 1.8 * 1024 * 1024) {
      reject(new Error('Image file must be smaller than 1.8 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}
