import { useEffect, useState } from 'react';
import { getSpecificUserApi } from '../../helpers/api_fetch/leaveMessage';

export type UserOption = {
  id: string | number;
  account_name: string;
  department?: string;
};

/** All internal users, for populating requester / assignee select boxes. Reuses the
 * existing /admin/getSpecificUser endpoint (already used for @mention candidates). */
export function useUserOptions() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getSpecificUserApi({ department: '' })
      .then((raw: any) => {
        if (cancelled) return;
        const list: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        const options = list
          .map((u) => ({
            id: u?.id,
            account_name: String(u?.account_name || '').trim(),
            department: u?.department ? String(u.department).trim() : undefined,
          }))
          .filter((u) => u.id !== undefined && u.id !== null && u.account_name)
          .sort((a, b) => a.account_name.localeCompare(b.account_name));
        setUsers(options);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { users, loading };
}
