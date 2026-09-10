import { toNum } from '../pages/OrderLists/helper';

export const badgeColorByKind = (
    kind: 'cad' | 'customs' | 'pickup' | 'order' | 'warehouse',
    v: any
) => {
  const n = toNum(v);

  // status 10 => Delete Pending => yellow
  if (n === 10) return 'warning';

  // CAD: 2 Approved(Release)=green, 3 Rejected=red, 1 Submitted(processing)=yellow
  if (kind === 'cad') {
    if (n === 2) return 'success';
    if (n === 3) return 'danger';
    if (n === 1) return 'warning';
    return 'secondary';
  }

  // Customs (CBSA): 4=Released, 1=Accepted → green; 2=Rejected, 5=Exam Required → red; 9=Accepted/Waiting, 34=Accepted/Awaiting Customs → yellow
  if (kind === 'customs') {
    if (n === 4 || n === 1) return 'success';
    if (n === 2 || n === 5) return 'danger';
    if (n === 9 || n === 34) return 'warning';
    return 'secondary';
  }

  // Pickup / logistic: 3 Delivered or 6 Total Completed = green, 4 Rejected = red, 0/1/2 In progress/In transit / 8 Pending Complete = yellow
  if (kind === 'pickup') {
    if (n === 4 || n === 7) return 'danger'; // 7 = Deleted
    if (n === 3 || n === 6) return 'success';
    if (n === 0 || n === 1 || n === 2 || n === 8) return 'warning';
    return 'secondary';
  }

  // Order (optional): 4 Released/5 Completed = green, 6 Rejected = red, 1 Processing/2 Pending = yellow
  if (kind === 'order') {
    if (n === 4 || n === 5) return 'success';
    if (n === 6 || n === 7) return 'danger'; // 7 = Deleted
    if (n === 1 || n === 2) return 'warning';
    return 'secondary';
  }

  // Warehouse: 3 Delivered = green, 2 Dispatched = yellow
  if (kind === 'warehouse') {
    if (n === 3) return 'success';
    if (n === 2) return 'warning';
    if (n === 7) return 'danger'; // Deleted
    return 'secondary';
  }

  return 'secondary';
};

type Kind = 'cad' | 'customs' | 'pickup' | 'order' | 'warehouse';

export const textClassByKind = (kind: Kind, v: any) => {
  // empty => muted (no data)
  if (v === null || v === undefined || String(v).trim() === '') return 'text-muted';

  const c = badgeColorByKind(kind, v);

  if (c === 'success') return 'text-success fw-semibold';
  if (c === 'danger') return 'text-danger fw-semibold';
  if (c === 'warning') return 'text-warning fw-semibold';

  // secondary / fallback:
  // if it’s a number but not mapped => neutral dark
  const n = toNum(v);
  if (Number.isFinite(n)) return 'text-secondary';

  // truly unknown
  return 'text-muted';
};



export const formatCanadianPostcode = (value: any) => {
  const raw = String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')

  if (raw.length <= 3) return raw
  return `${raw.slice(0, 3)} ${raw.slice(3, 6)}`
}

export const isValidCanadianPostcode = (value: any) => {
  const formatted = formatCanadianPostcode(value)
  return /^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(formatted)
}

export const formatDeliveryCity = (value: any) => {
  return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\b[a-z]/g, (c) => c.toUpperCase())
}