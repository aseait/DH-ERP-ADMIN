/**
 * Format a raw DB date value (YYYY-MM-DD or YYYY-MM-DD HH:mm:ss) to MM/DD/YYYY.
 * Returns '' for any falsy / unparseable value so cells stay blank.
 */
export const fmtDate = (v: unknown): string => {
  if (!v) return '';
  const s = String(v).trim();
  if (!s || s.toLowerCase().startsWith('invalid') || s.startsWith('0000-00-00')) return '';
  const datePart = s.length > 10 ? s.substring(0, 10) : s;
  const parts = datePart.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    if (year === '0000' || (month === '00' && day === '00')) return '';
    return `${month}/${day}/${year}`;
  }
  return datePart;
};

/**
 * Format a raw DB datetime value (YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm) to MM/DD/YYYY HH:mm.
 * Returns '' for any falsy / unparseable value so cells stay blank.
 */
export const fmtDateTime = (v: unknown): string => {
  if (!v) return '';
  const s = String(v).trim();
  if (!s || s.toLowerCase().startsWith('invalid') || s.startsWith('0000-00-00')) return '';
  const normalized = s.replace('T', ' ');
  const [datePart = '', timePart = ''] = normalized.split(' ');
  const parts = datePart.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    if (year === '0000' || (month === '00' && day === '00')) return '';
    const time = timePart.substring(0, 5);
    return time && time !== '00:00' ? `${month}/${day}/${year} ${time}` : `${month}/${day}/${year}`;
  }
  return datePart;
};
