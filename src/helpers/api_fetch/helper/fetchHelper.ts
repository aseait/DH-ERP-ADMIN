interface ApiError {
  status: number;
  message: string;
  [key: string]: any;
}

export const doFetch = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || undefined);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    const error: ApiError = {
      status: res.status,
      message: data?.message || res.statusText || 'Request failed',
      ...data,
    };
    throw error;
  }

  return data;
};
