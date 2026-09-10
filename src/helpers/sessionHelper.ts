export function createSessionState<T extends Record<string, any>>(key: string) {
  const read = (): Partial<T> | null => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      return obj as Partial<T>;
    } catch {
      return null;
    }
  };

  const write = (value: T) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  const clear = () => {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  };

  return { read, write, clear };
}
