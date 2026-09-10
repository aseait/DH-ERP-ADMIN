import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { fetchCitiesApi } from '../../helpers/api_fetch/order';

interface CityOption {
  city: string;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  isDisabled?: boolean;
}

const SelectDestination: React.FC<Props> = ({ value, onChange, placeholder = 'Destination', className, isDisabled }) => {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetchCitiesApi()
      .then((res: any) => {
        const cities: CityOption[] = res?.data ?? [];
        setOptions(cities.map((c) => ({ value: c.city, label: c.city })));
      })
      .catch(() => {});
  }, []);

  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <div className={`sl-wrap${className ? ` ${className}` : ''}`}>
      <Select
        options={options}
        value={selected}
        onChange={(opt: { value: string; label: string } | null) => onChange(opt ? opt.value : '')}
        placeholder={placeholder}
        isClearable
        isSearchable
        isDisabled={isDisabled}
        classNamePrefix="rs"
      />
    </div>
  );
};

export default SelectDestination;
