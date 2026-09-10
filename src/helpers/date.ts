export const toDateOnly = (val?: any) => {
  const s = String(val ?? '').trim();
  if (!s) return '';
  if (s.toLowerCase().startsWith('invalid')) return '';
  return s.length >= 10 ? s.slice(0, 10) : s;
};

// Converts a raw DB datetime (e.g. "2026-07-13 10:56:00") to the value a
// <input type="datetime-local"> control expects ("2026-07-13T10:56").
export const toDateTimeLocal = (val?: any): string => {
  const s = String(val ?? '').trim();
  if (!s) return '';
  return s.replace(' ', 'T').substring(0, 16);
};

// Converts a <input type="datetime-local"> value back to the "YYYY-MM-DD HH:mm:ss"
// format the backend expects.
export const fromDateTimeLocal = (val?: any): string | undefined => {
  const s = String(val ?? '').trim();
  if (!s) return undefined;
  return `${s.replace('T', ' ')}:00`;
};
