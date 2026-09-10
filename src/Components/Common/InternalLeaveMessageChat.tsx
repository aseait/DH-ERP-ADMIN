import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Input,
  Offcanvas,
  OffcanvasBody,
  Spinner,
} from 'reactstrap';
import SimpleBar from 'simplebar-react';

import {
  postInternalNoteApi,
  retrieveInternalNotesApi,
  markInternalNotesAsReadApi,
  getSpecificUserApi,
} from '../../helpers/api_fetch/leaveMessage';
import { useTT } from '../../helpers/useTT';

type AuthUser = {
  user_id?: string;
  user_name?: string;
  email?: string;
  company_name?: string;
  contact_id?: number | string;
  contact_name?: string;
  account_name?: string;
  department?: string;
};

type MentionCandidate = {
  key: string;
  label: string;
  department: string;
};

type Props = {
  taskId: string | number;
  extraTaskIds?: Array<string | number>;
  title?: string;
  id?: string;
  number?: string;
  awb?: string;
  placement?: 'end' | 'start';
};

const pickName = (u?: Partial<AuthUser> | null): string => {
  if (!u) return '';
  return (
    u.user_name || u.account_name || u.contact_name || u.company_name ||
    (u.email ? u.email.split('@')[0] : '') || ''
  );
};

const getAuthUser = (): Partial<AuthUser> => {
  try {
    const raw = sessionStorage.getItem('authUser');
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
};

const safeTimeValue = (val: any) => {
  const t = new Date(val ?? '').getTime();
  return Number.isNaN(t) ? 0 : t;
};

const formatBrowserTime = (val: any): string => {
  if (!val) return '';
  const raw = String(val).trim();
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const renderNoteText = (text: string): string => {
  const raw = String(text || '');
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/@\[(.*?)\]/g, '<span class="lm-mention-tag">@$1</span>')
    .replace(/\n/g, '<br />');
};

const extractMentions = (text: string): string[] => {
  const matches = Array.from(String(text || '').matchAll(/@\[(.*?)\]/g));
  return matches.map((m) => String(m[1] || '').trim()).filter(Boolean);
};

const normalizeList = (x: any): any[] => {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.payload)) return x.payload;
  if (Array.isArray(x?.result)) return x.result;
  return [];
};

const normalizeTaskIds = (taskId: string | number, extraTaskIds?: Array<string | number>) => {
  const ids = [taskId, ...(Array.isArray(extraTaskIds) ? extraTaskIds : [])]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
};

export default function InternalLeaveMessageChat({
  taskId,
  extraTaskIds = [],
  title = 'Internal Chat',
  id = 'internalLeaveMessageScroll',
  number = '',
  awb = '',
  placement = 'end',
}: Props) {
  const { tt } = useTT();
  const authUser = useMemo(() => getAuthUser(), []);
  const currentUserName = useMemo(() => pickName(authUser), [authUser]);
  const currentUserDepartment = useMemo(() => String(authUser?.department || '').trim(), [authUser]);

  const [isDrawer, setIsDrawer] = useState(false);
  const [keyWord, setKeyWord] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [isDot, setIsDot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  const chatRef = useRef<any>(null);

  const normalizedTaskId = useMemo(() => String(taskId || '').trim(), [taskId]);
  const normalizedNumber = useMemo(() => String(number || '').trim().toUpperCase(), [number]);
  const normalizedAwb = useMemo(() => String(awb || '').trim(), [awb]);
  const normalizedExtraTaskIds = useMemo(
    () =>
      Array.from(
        new Set(
          (Array.isArray(extraTaskIds) ? extraTaskIds : [])
            .map((v) => String(v || '').trim())
            .filter(Boolean)
        )
      ),
    [extraTaskIds]
  );

  const allTaskIds = useMemo(
    () => normalizeTaskIds(taskId, extraTaskIds),
    [taskId, extraTaskIds]
  );

  const identifierReady = useMemo(
    () => !!(normalizedNumber || normalizedAwb),
    [normalizedNumber, normalizedAwb]
  );

  const disabledOpen = !normalizedTaskId || !identifierReady;

  const normalizeName = (v: any) => String(v || '').trim().toLowerCase();

  const mentionDepartmentMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    mentionCandidates.forEach((item) => {
      const key = normalizeName(item.label);
      if (key && !map[key]) {
        map[key] = item.department || '';
      }
    });
    if (currentUserName) {
      const myKey = normalizeName(currentUserName);
      if (!map[myKey]) map[myKey] = currentUserDepartment;
    }
    return map;
  }, [mentionCandidates, currentUserName, currentUserDepartment]);

  const filteredMentionCandidates = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return mentionCandidates;
    return mentionCandidates.filter(
      (x) => x.label.toLowerCase().includes(q) || x.department.toLowerCase().includes(q)
    );
  }, [mentionCandidates, mentionQuery]);

  const allowedMentionNames = useMemo(
    () => mentionCandidates.map((x) => x.label.trim().toLowerCase()),
    [mentionCandidates]
  );

  const getSenderName = (item: any) => String(item?.sender_name ?? '').trim();

  const getSenderDepartment = (item: any) => {
    const sender = getSenderName(item);
    if (!sender) return '';
    return String(
      item?.sender_department ?? item?.department ?? mentionDepartmentMap[normalizeName(sender)] ?? ''
    ).trim();
  };

  const formatSenderDisplay = (item: any) => {
    const sender = getSenderName(item);
    if (!sender) return '-';
    const dept = getSenderDepartment(item);
    return dept ? `${sender} (${dept})` : sender;
  };

  const toBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollTop = el.scrollHeight;
      if (chatRef.current?.getScrollElement) {
        const se = chatRef.current.getScrollElement();
        se.scrollTop = se.scrollHeight;
      }
    });
  }, [id]);

  const mergeMessages = useCallback((rows: any[]) => {
    const map = new Map<string, any>();
    rows.forEach((m: any, idx: number) => {
      const key =
        m?.note_id != null
          ? `note_${m.note_id}`
          : `${m?.task_id || ''}_${m?.sender_name || ''}_${m?.create_time || ''}_${idx}`;
      if (!map.has(key)) map.set(key, m);
    });
    return Array.from(map.values()).sort(
      (a, b) => safeTimeValue(a?.create_time) - safeTimeValue(b?.create_time)
    );
  }, []);

  const getList = useCallback(async () => {
    if (!normalizedTaskId || !identifierReady) {
      setList([]);
      setIsDot(false);
      return [];
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        allTaskIds.map((idVal) =>
          retrieveInternalNotesApi({
            task_id: idVal,
            container_number: normalizedNumber || null,
            awb: normalizedAwb || null,
          }).catch(() => null)
        )
      );

      const mergedRaw = results.flatMap((res: any) => {
        if (!res) return [];
        return normalizeList(res?.data ?? res);
      });

      const merged = mergeMessages(mergedRaw);
      setList(merged);

      const unreadCount = merged.filter((item: any) => {
        if (getSenderName(item) === currentUserName) return false;
        const readBy =
          typeof item.read_status_internal === 'string'
            ? item.read_status_internal
                .split(',')
                .map((n: string) => n.trim())
                .filter(Boolean)
            : [];
        return !readBy.includes(currentUserName);
      }).length;

      setIsDot(unreadCount > 0);
      toBottom();
      return merged;
    } catch (e) {
      console.error('[InternalLeaveMessageChat.getList] error', e);
      setList([]);
      setIsDot(false);
      return [];
    } finally {
      setLoading(false);
    }
  }, [allTaskIds, normalizedTaskId, identifierReady, normalizedNumber, normalizedAwb, currentUserName, mergeMessages, toBottom]);

  const loadMentionUsers = useCallback(async () => {
    try {
      const depts = ['DH', 'Logistic', 'Finance', 'Customer Service'];
      const results = await Promise.allSettled(
        depts.map((department) => getSpecificUserApi({ department }))
      );

      const allUsers: any[] = [];
      results.forEach((r, index) => {
        if (r.status === 'fulfilled') {
          const departmentName = depts[index];
          const raw = r.value;
          const userList = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.data)
            ? raw.data
            : [];
          userList.forEach((u: any) => {
            allUsers.push({ ...u, __department: String(u?.department || departmentName || '').trim() });
          });
        }
      });

      const seen = new Set<string>();
      const candidates: MentionCandidate[] = allUsers
        .map((u: any) => ({
          label: String(u?.account_name || '').trim(),
          department: String(u?.__department || '').trim(),
        }))
        .filter((u) => u.label)
        .filter((u) => {
          const k = u.label.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((u) => ({ key: `${u.label}__${u.department}`, label: u.label, department: u.department }));

      setMentionCandidates(candidates);
    } catch (e) {
      console.error('[InternalLeaveMessageChat.loadMentionUsers] error', e);
    }
  }, []);

  useEffect(() => {
    getList();
  }, [getList]);

  useEffect(() => {
    loadMentionUsers();
  }, [loadMentionUsers]);

  useEffect(() => {
    if (!isDrawer) return;
    toBottom();
  }, [list, isDrawer, toBottom]);

  const openDrawer = useCallback(async () => {
    setIsDrawer(true);

    const freshList = list.length > 0 ? list : await getList();

    const unreadList = freshList.filter((item: any) => {
      if (getSenderName(item) === currentUserName) return false;
      const readBy =
        typeof item.read_status_internal === 'string'
          ? item.read_status_internal
              .split(',')
              .map((n: string) => n.trim())
              .filter(Boolean)
          : [];
      return !readBy.includes(currentUserName);
    });

    if (unreadList.length > 0) {
      try {
        await markInternalNotesAsReadApi({
          note_ids: unreadList.map((item: any) => item.note_id).filter((v: any) => v != null),
          name: currentUserName,
        });
        await getList();
      } catch (e) {
        console.error('[InternalLeaveMessageChat.markRead] error', e);
      }
    }
  }, [list, getList, currentUserName]);

  const handleComposerInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setKeyWord(val);

      const atIndex = val.lastIndexOf('@');
      if (atIndex < 0) {
        setShowMention(false);
        setMentionQuery('');
        setMentionStartIndex(-1);
        return;
      }

      const before = val.slice(0, atIndex);
      const after = val.slice(atIndex + 1);

      if (after.includes('\n') || before.endsWith(']')) {
        setShowMention(false);
        setMentionQuery('');
        setMentionStartIndex(-1);
        return;
      }

      setMentionStartIndex(atIndex);
      setMentionQuery(after.trim());
      setShowMention(mentionCandidates.length > 0);
    },
    [mentionCandidates.length]
  );

  const applyMention = useCallback(
    (name: string) => {
      setKeyWord((prev) => {
        if (mentionStartIndex < 0) return prev;
        const before = prev.slice(0, mentionStartIndex);
        const after = prev.slice(mentionStartIndex + 1 + mentionQuery.length);
        return `${before}@[${name}] ${after}`;
      });
      setShowMention(false);
      setMentionQuery('');
      setMentionStartIndex(-1);
    },
    [mentionStartIndex, mentionQuery]
  );

  const canSend = !!String(keyWord ?? '').trim() && !!normalizedTaskId && identifierReady;

  const send = useCallback(async () => {
    const v = String(keyWord ?? '').trim();
    if (!v || !normalizedTaskId || !identifierReady) return;

    const mentions = extractMentions(v);
    const invalidMentions = mentions.filter((m) => !allowedMentionNames.includes(m.toLowerCase()));
    if (invalidMentions.length > 0) {
      alert(tt('internalChat.invalidMention'));
      return;
    }

    setPosting(true);
    try {
      await postInternalNoteApi({
        task_id: normalizedTaskId,
        note_text: v,
        sender_name: currentUserName,
        sender_department: currentUserDepartment,
        read_status_internal: currentUserName,
        container_number: normalizedNumber || null,
        awb: normalizedAwb || null,
      });

      setKeyWord('');
      setShowMention(false);
      setMentionQuery('');
      setMentionStartIndex(-1);
      await getList();
    } catch (e) {
      console.error('[InternalLeaveMessageChat.send] error', e);
    } finally {
      setPosting(false);
    }
  }, [
    keyWord,
    normalizedTaskId,
    identifierReady,
    currentUserName,
    currentUserDepartment,
    normalizedNumber,
    normalizedAwb,
    allowedMentionNames,
    getList,
  ]);

  return (
    <div className="lm-root">
      <div className="lm-trigger">
        <Button
          color="primary"
          className="lm-trigger__btn"
          onClick={openDrawer}
          disabled={disabledOpen}
        >
          {tt('internalChat.title')}
        </Button>

        {isDot && <span className="lm-trigger__dot" />}
      </div>

      <Offcanvas
        isOpen={isDrawer}
        toggle={() => setIsDrawer(false)}
        direction={placement}
        className="lm-drawer"
      >
        <OffcanvasBody className="lm-body">
          <div className="lm-header">
            <div className="lm-header__left">
              <div className="lm-title">{title}</div>
              <div className="lm-subtitle">
                {normalizedNumber ? tt('internalChat.container', { number: normalizedNumber }) : normalizedAwb ? tt('internalChat.awb', { awb: normalizedAwb }) : ''}
              </div>
            </div>
            <div className="lm-header__right">
              <button
                className="lm-iconBtn"
                type="button"
                aria-label="Refresh"
                onClick={() => getList()}
              >
                <i className="ri-refresh-line" />
              </button>
              <button
                className="lm-iconBtn"
                type="button"
                aria-label="Close"
                onClick={() => setIsDrawer(false)}
              >
                <i className="ri-close-line" />
              </button>
            </div>
          </div>

          <div className="lm-content">
            {loading ? (
              <div className="lm-state">
                <Spinner size="sm" className="me-2" />
                {tt('internalChat.loading')}
              </div>
            ) : (
              <SimpleBar ref={chatRef} className="lm-scroll">
                <div id={id} className="lm-scrollInner">
                  <ul className="lm-list">
                    {list.length === 0 ? (
                      <li className="lm-empty">{tt('internalChat.noData')}</li>
                    ) : (
                      list.map((m: any, idx: number) => {
                        const isMine = getSenderName(m) === currentUserName;
                        return (
                          <li
                            key={m.note_id ?? idx}
                            className={`lm-row ${isMine ? 'is-mine' : 'is-other'}`}
                          >
                            <div className="lm-bubble">
                              <div className="lm-meta">
                                <span className="lm-sender">{formatSenderDisplay(m)}</span>
                                <span className="lm-time">{formatBrowserTime(m.create_time)}</span>
                              </div>
                              <div
                                className="lm-text"
                                dangerouslySetInnerHTML={{ __html: renderNoteText(m.note_text) }}
                              />
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </SimpleBar>
            )}
          </div>

          <div className="lm-composer">
            {showMention && filteredMentionCandidates.length > 0 && (
              <div className="lm-mention-panel">
                {filteredMentionCandidates.map((item) => (
                  <div
                    key={item.key}
                    className="lm-mention-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyMention(item.label);
                    }}
                  >
                    <div className="lm-mention-name">@{item.label}</div>
                    <div className="lm-mention-type">{item.department || '-'}</div>
                  </div>
                ))}
              </div>
            )}
            <Input
              type="textarea"
              rows={4}
              value={keyWord}
              onChange={handleComposerInput}
              placeholder={tt('internalChat.placeholder')}
              className="lm-composer__input"
            />
            <div className="lm-composer__actions">
              <Button
                color="primary"
                className="lm-sendBtn"
                disabled={posting || !canSend}
                onClick={send}
              >
                {posting ? tt('internalChat.sending') : tt('internalChat.send')}
              </Button>
            </div>
          </div>
        </OffcanvasBody>
      </Offcanvas>
    </div>
  );
}
