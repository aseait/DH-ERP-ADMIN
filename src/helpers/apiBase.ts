export const getApiBase = (): string => {
  const runtimeBase =
    typeof window !== 'undefined' ? (window as any).__APP_CONFIG__?.API_BASE?.trim?.() : '';

  return (runtimeBase && runtimeBase.replace(/\/+$/, '')) || '';
};

export const buildApiUrl = (path: string): string => {
  const base = getApiBase();
  const cleanPath = (path || '').startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};
