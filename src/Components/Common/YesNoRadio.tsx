import React from 'react';

export const normalizeYesNo = (v: any): 'Yes' | 'No' | '' => {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (s === '1' || s === 'yes' || s === 'y' || s === 'true') return 'Yes';
  if (s === '0' || s === 'no' || s === 'n' || s === 'false') return 'No';
  if (v === 'Yes' || v === 'No') return v;
  return '';
};

export const yesNoTo01 = (v: any): 1 | 0 | null => {
  const n = normalizeYesNo(v);
  if (n === 'Yes') return 1;
  if (n === 'No') return 0;
  return null;
};

export const YesNoRadio = ({
  name,
  value,
  disabled,
  onChange,
  yesLabel,
  noLabel,
}: {
  name: string;
  value: any;
  disabled?: boolean;
  onChange: (v: 'Yes' | 'No') => void;
  /** pass tt("common.yes") */
  yesLabel: string;
  /** pass tt("common.no") */
  noLabel: string;
}) => {
  const v = normalizeYesNo(value);

  return (
    <div className={`md-radio ${disabled ? 'is-disabled' : ''}`}>
      <label className="md-radio__opt">
        <input
          type="radio"
          name={name}
          disabled={disabled}
          checked={v === 'Yes'}
          onChange={() => onChange('Yes')}
        />
        <span>{yesLabel}</span>
      </label>

      <label className="md-radio__opt">
        <input
          type="radio"
          name={name}
          disabled={disabled}
          checked={v === 'No'}
          onChange={() => onChange('No')}
        />
        <span>{noLabel}</span>
      </label>
    </div>
  );
};
