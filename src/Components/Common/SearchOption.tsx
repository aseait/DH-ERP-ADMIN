import React, { useMemo, useCallback, useState } from 'react';
import { Input } from 'reactstrap';
import { useNavigate } from 'react-router-dom';

import { createSessionState } from '../../helpers/sessionHelper';
import { getUserIdFromSession } from '../../helpers/userInformation';
import { useTT } from '../../helpers/useTT';

const ORDER_LIST_ROUTE = '/order_run/list/all';
const ORDERLIST_SESSION_KEY = 'orderlist.queryParams.v1';

// must match All.tsx QueryParams shape (at least the fields we touch)
type QueryParams = {
  page: number;
  pageSize: number;
  user_id?: any;

  service_state: '1' | '2';
  portETA_start: string;
  portETA_end: string;
  trainETA_start: string;
  trainETA_end: string;

  service: '' | 'marine' | 'air' | 'truck';
  destination: string;

  status: '0' | '1' | '2' | '3' | '4';
  cargoNumber: string;
};

const orderListSession = createSessionState<QueryParams>(ORDERLIST_SESSION_KEY);

const CARGO_LS_KEY = 'orderlist.cargo';

const SearchOption: React.FC = () => {
  const navigate = useNavigate();
  const { tt } = useTT();
  // initialise from localStorage so the header shows the current filter on any refresh
  const [value, setValue] = useState(() => localStorage.getItem(CARGO_LS_KEY) || '');

  const sanitized = useMemo(() => String(value || '').replace(/\s+/g, ''), [value]);

  const writeCargoToSession = useCallback((cargoNumber: string) => {
    const base: QueryParams = {
      page: 1,
      pageSize: 10,
      user_id: getUserIdFromSession(),

      service_state: '1',
      portETA_start: '',
      portETA_end: '',
      trainETA_start: '',
      trainETA_end: '',

      service: '',
      destination: '',
      status: '4',
      cargoNumber: '',
    };

    const saved = orderListSession.read();
    const next: QueryParams = {
      ...base,
      ...(saved ?? {}),
      user_id: getUserIdFromSession(),
      page: 1,
      cargoNumber,
    };

    orderListSession.write(next);

    // also persist to localStorage so All.tsx and this header stay in sync across refreshes
    if (cargoNumber) {
      localStorage.setItem(CARGO_LS_KEY, cargoNumber);
    } else {
      localStorage.removeItem(CARGO_LS_KEY);
    }
  }, []);

  const doSearch = useCallback(() => {
    const v = sanitized;
    const cargo = v || '';

    writeCargoToSession(cargo);

    // navigate with ?q= so All.tsx reads the value from the URL on mount
    const target = cargo
      ? `${ORDER_LIST_ROUTE}?q=${encodeURIComponent(cargo)}`
      : ORDER_LIST_ROUTE;

    // fire the event first (handles the case where we're already on the page)
    window.dispatchEvent(new CustomEvent('orderlist:cargo-search', { detail: { cargoNumber: cargo } }));

    navigate(target);
  }, [navigate, sanitized, writeCargoToSession]);

  const clearSearch = useCallback(() => {
    writeCargoToSession('');
    window.dispatchEvent(new CustomEvent('orderlist:cargo-search', { detail: { cargoNumber: '' } }));
    setValue('');
    navigate(ORDER_LIST_ROUTE);
  }, [navigate, writeCargoToSession]);

  return (
    <form
      className="app-search d-none d-md-block"
      onSubmit={(e) => {
        e.preventDefault();
        doSearch();
      }}
    >
      <div className="position-relative">
        <Input
          type="text"
          className="form-control"
          placeholder={tt('orderList.table.containerOrAwb')}
          value={value}
          onChange={(e: any) => setValue(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              doSearch();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              clearSearch();
            }
          }}
        />

        {/* search icon */}
        <span
          className="mdi mdi-magnify search-widget-icon"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            doSearch();
          }}
          title="Search"
        />

        {/* clear icon (clear session filter + header input) */}
        {sanitized ? (
          <span
            className="mdi mdi-close-circle search-widget-icon search-widget-icon-close"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              clearSearch();
            }}
            title="Clear"
          />
        ) : null}
      </div>
    </form>
  );
};

export default SearchOption;
