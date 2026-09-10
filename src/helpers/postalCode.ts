import { buildApiUrl } from './apiBase';
import { FETCH_POSTAL_CODE_OPTIONS } from './url_helper';

export type ProvinceOption = { value: string; label: string; province_code: string; province_name: string };
export type AreaOption = { value: string; label: string; area_name: string };
export type FsaOption = { value: string; label: string; fsa: string };

export function debounce<A extends any[], R>(fn: (...args: A) => Promise<R>, delay = 200): (...args: A) => Promise<R> {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: A) => new Promise<R>(resolve => {
    clearTimeout(timer);
    timer = setTimeout(() => resolve(fn(...args)), delay);
  });
}

export async function postalCodeOptions(body: Record<string, any>): Promise<any[]> {
  try {
    const res = await fetch(buildApiUrl(FETCH_POSTAL_CODE_OPTIONS), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    return Array.isArray(d?.data) ? d.data : [];
  } catch {
    return [];
  }
}

export const loadProvinceOptions = debounce(async (search: string): Promise<ProvinceOption[]> => {
  const rows = await postalCodeOptions({ search });
  return rows.map((r: any) => ({
    value: r.province_code,
    label: r.province_name,
    province_code: r.province_code,
    province_name: r.province_name,
  }));
});

export function makeAreaLoader(provinceCode: string) {
  return debounce(async (search: string): Promise<AreaOption[]> => {
    if (!provinceCode) return [];
    const rows = await postalCodeOptions({ province_code: provinceCode, search });
    return rows.map((r: any) => ({
      value: r.area_name,
      label: r.area_name,
      area_name: r.area_name,
    }));
  });
}

export function makeFsaLoader(provinceCode: string, areaName: string) {
  return debounce(async (search: string): Promise<FsaOption[]> => {
    if (!provinceCode || !areaName) return [];
    const rows = await postalCodeOptions({ province_code: provinceCode, area_name: areaName, search });
    return rows.map((r: any) => ({
      value: r.fsa,
      label: r.municipalities ? `${r.fsa} (${r.municipalities})` : r.fsa,
      fsa: r.fsa,
    }));
  });
}
