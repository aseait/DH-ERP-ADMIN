import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { fetchAdminContactsApi } from '../../helpers/api_fetch/order';

interface UserOption {
  id: string;
  Account_Name: { name: string } | null;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  isDisabled?: boolean;
}

const SelectUser: React.FC<Props> = ({ value, onChange, placeholder = 'Select Client', className, isDisabled }) => {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetchAdminContactsApi('', 999)
      .then((res: any) => {
        const users: UserOption[] = res?.data ?? [];
        setOptions(
          users.map((u) => ({
            value: u.id,
            label: u.Account_Name?.name || 'No Name',
          }))
        );
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

export default SelectUser;
