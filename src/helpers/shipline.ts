export type ShiplineOption = {
    label: string;
    code: string;
};

export const SHIPLINE_OPTIONS: ShiplineOption[] = [
    { label: 'COSCO', code: 'COSU' },
    { label: 'CMA CGM', code: 'CMDU' },
    { label: 'EVERGREEN', code: 'EGLV' },
    { label: 'Hapag-Lloyd', code: 'HLCU' },
    { label: 'HMM', code: 'HDMU' },
    { label: 'MAERSK', code: 'MAEU' },
    { label: 'MSC', code: 'MSCU' },
    { label: 'OOCL', code: 'OOLU' },
    { label: 'ONE', code: 'ONEY' },
    { label: 'SM LINE', code: 'SMLM' },
    { label: 'Yang Ming', code: 'YMLU' },
    { label: 'ZIM', code: 'ZIMU' },
];

const safe = (v: any) => String(v ?? '').trim();

export function getShiplineDisplay(value: any): string {
    const raw = safe(value);
    if (!raw) return '';

    const byCode = SHIPLINE_OPTIONS.find(
        (x) => x.code.toLowerCase() === raw.toLowerCase()
    );
    if (byCode) return byCode.label;
    // const byName = SHIPLINE_OPTIONS.find(
    //     (x) => x.label.toLowerCase() === raw.toLowerCase()
    // );
    // if (byName) return byName.label;

    return raw;
}