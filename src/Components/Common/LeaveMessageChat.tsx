import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Button,
  Dropdown,
  DropdownMenu,
  DropdownToggle,
  Input,
  Offcanvas,
  OffcanvasBody,
  Spinner,
} from 'reactstrap';
import SimpleBar from 'simplebar-react';
import FeatherIcon from 'feather-icons-react';
import { createSelector } from 'reselect';
import { useDispatch, useSelector } from 'react-redux';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';

import { useTT } from '../../helpers/useTT';
import {
  retrieveLeaveMessages,
  postLeaveMessage,
  markLeaveMessagesAsRead,
} from '../../slices/leaveMessage/thunk';
import { fetchUserEmailApi, sendMailApi } from '../../helpers/api_fetch/email';
import { buildNoteEmail, parseRecipientList } from '../../helpers/mailTemplates';

type AuthUser = {
  id?: number | string;
  user_id?: string;
  user_name?: string;
  email?: string;
  company_name?: string;
  contact_id?: number | string;
  contact_name?: string;
  account_name?: string;
  department?: string;
  create_time?: string;
};

type AppDispatch = ThunkDispatch<any, any, AnyAction>;

type MentionCandidate = {
  key: string;
  label: string;
  type: 'assigned' | 'owner';
};

type Props = {
  taskId: string | number;
  extraTaskIds?: Array<string | number>;

  title?: string;
  id?: string;

  number?: string;
  awb?: string;

  type?: 0 | 1;
  placement?: 'end' | 'start';

  openKey?: string;
  sendKey?: string;
  placeholderKey?: string;

  userId?: string | number;
  assignedName?: string;
  ticketUserName?: string;
};

const pickDisplayName = (u?: Partial<AuthUser> | null) => {
  if (!u) return '';
  return (
    u.user_name || u.account_name || u.contact_name || u.company_name ||
    (u.email ? u.email.split('@')[0] : '') || ''
  );
};

const resolveSenderLabel = (u?: Partial<AuthUser> | null): string => {
  if (!u) return '';
  const dep = String(u.department || '').trim();
  let deptLabel = '';
  if (dep === 'DH') deptLabel = 'Customs Brokerage';
  else if (dep === 'Logistic') deptLabel = 'Logistic Department';
  else if (dep === 'Customer Service') deptLabel = 'Customer Service';

  const name = pickDisplayName(u);
  return deptLabel ? `${deptLabel} ${name}`.trim() : name;
};

function useAuthUser() {
  const selectAccountSlice = (s: any) => s.Account;

  const accountUserSelector = useMemo(
    () =>
      createSelector([selectAccountSlice], (account) => {
        return (account?.user as Partial<AuthUser>) || {};
      }),
    []
  );

  const userFromRedux = useSelector(accountUserSelector);
  const [user, setUser] = useState<Partial<AuthUser>>({});

  useEffect(() => {
    if (userFromRedux && Object.keys(userFromRedux).length > 0) {
      setUser(userFromRedux);
      return;
    }

    const raw = sessionStorage.getItem('authUser');
    if (raw) {
      try {
        const parsed: Partial<AuthUser> = JSON.parse(raw);
        setUser(parsed || {});
      } catch {
        setUser({});
      }
    }
  }, [userFromRedux]);

  const userId = (user?.user_id ?? user?.contact_id ?? user?.id ?? '') as any;
  const userName = pickDisplayName(user);
  const senderLabel = resolveSenderLabel(user);

  return { user, userId, userName, senderLabel };
}

const safeTT = (ttFn: (k: string) => any, key: string | undefined, fallback: string) => {
  if (!key) return fallback;
  const v = ttFn(key);
  return v || fallback;
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

export default function LeaveMessageChat({
  taskId,
  extraTaskIds = [],
  title = '',
  id = 'leaveMessageScroll',
  number = '',
  awb = '',
  type = 0,
  placement = 'end',
  openKey = 'chat.title',
  sendKey = 'chat.send',
  placeholderKey = 'chat.notification',
  userId: propUserId,
  assignedName = '',
  ticketUserName = '',
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { tt } = useTT();
  const { userId: authUserId, userName, senderLabel } = useAuthUser();

  // authUserId is always the logged-in admin's own ID — used for ownership checks.
  // propUserId (clientUserId from parent) is reserved for email notifications only.
  const userId = authUserId;

  const leaveMessageSlice = useSelector((s: any) => s.leaveMessage || {});
  const sliceMessages = normalizeList(leaveMessageSlice.messages);
  const retrieving = !!leaveMessageSlice.retrieving;
  const posting = !!leaveMessageSlice.posting;

  const [isDrawer, setIsDrawer] = useState(false);
  const [keyWord, setKeyWord] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [list, setList] = useState<any[]>([]);
  const [isDot, setIsDot] = useState(false);

  // @mention
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  const chatRef = useRef<any>(null);

  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    const list: MentionCandidate[] = [];
    const an = String(assignedName || '').trim();
    const tun = String(ticketUserName || '').trim();
    if (an) list.push({ key: 'assigned', label: an, type: 'assigned' });
    if (tun) list.push({ key: 'owner', label: tun, type: 'owner' });

    const seen = new Set<string>();
    return list.filter((x) => {
      const k = x.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [assignedName, ticketUserName]);

  const filteredMentionCandidates = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return mentionCandidates;
    return mentionCandidates.filter((x) => x.label.toLowerCase().includes(q));
  }, [mentionCandidates, mentionQuery]);

  const allowedMentionNames = useMemo(
    () => mentionCandidates.map((x) => x.label.trim().toLowerCase()),
    [mentionCandidates]
  );

  const allTaskIds = useMemo(
    () => normalizeTaskIds(taskId, extraTaskIds),
    [taskId, extraTaskIds]
  );

  const identifierReady = useMemo(() => {
    if (type === 1) return !!String(awb || '').trim();
    return !!String(number || '').trim();
  }, [type, awb, number]);

  const disabledOpen = !allTaskIds.length || !identifierReady;

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
          : `${m?.task_id || ''}_${m?.user_id || ''}_${m?.create_time || ''}_${idx}`;

      if (!map.has(key)) {
        map.set(key, m);
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => safeTimeValue(a?.create_time) - safeTimeValue(b?.create_time)
    );
  }, []);

  const getList = useCallback(async () => {
    if (!allTaskIds.length) return [];
    if (!identifierReady) return [];

    try {
      const results = await Promise.all(
        allTaskIds.map((idVal) =>
          dispatch(
            retrieveLeaveMessages({
              task_id: idVal,
              container_number: type === 0 ? number || null : null,
              awb: type === 1 ? awb || null : null,
            }) as any
          ).catch(() => null)
        )
      );

      const mergedRaw = results.flatMap((res: any) => {
        if (!res) return [];
        return normalizeList(res?.data ?? res);
      });

      const merged = mergeMessages(mergedRaw);
      setList(merged);
      toBottom();
      return merged;
    } catch (e) {
      console.error('[LeaveMessageChat.getList] error', e);
      setList([]);
      return [];
    }
  }, [allTaskIds, identifierReady, dispatch, type, number, awb, mergeMessages, toBottom]);

  useEffect(() => {
    if (!isDrawer) return;
    toBottom();
  }, [list, isDrawer, toBottom]);

  useEffect(() => {
    if (!identifierReady || !allTaskIds.length) {
      setList([]);
      setIsDot(false);
      return;
    }

    getList();
  }, [getList, identifierReady, allTaskIds.length]);

  useEffect(() => {
    const myName = userName.trim();
    const unreadCount = list.filter((m: any) => {
      if (String(m.user_id) === String(userId)) return false;
      const readBy =
        typeof m.read_status_admin === 'string'
          ? m.read_status_admin.split(',').map((n: string) => n.trim()).filter(Boolean)
          : [];
      return !readBy.includes(myName);
    }).length;

    setIsDot(unreadCount > 0);
  }, [list, userId, userName]);

  const openDrawer = useCallback(async () => {
    setIsDrawer(true);

    const freshList = await getList();

    const myName = userName.trim();
    const unreadFromOthers = freshList.filter((m: any) => {
      if (String(m.user_id) === String(userId)) return false;
      const readBy =
        typeof m.read_status_admin === 'string'
          ? m.read_status_admin.split(',').map((n: string) => n.trim()).filter(Boolean)
          : [];
      return !readBy.includes(myName);
    });

    if (unreadFromOthers.length > 0) {
      try {
        await dispatch(
          markLeaveMessagesAsRead({
            note_ids: unreadFromOthers
              .map((x: any) => x.note_id)
              .filter((v: any) => v != null),
            name: myName,
          }) as any
        );
      } catch (e) {
        console.error('[LeaveMessageChat.markRead] error', e);
      }

      setList((prev) =>
        prev.map((m: any) => {
          if (!unreadFromOthers.some((u: any) => String(u.note_id) === String(m.note_id))) return m;
          const existing = typeof m.read_status_admin === 'string' ? m.read_status_admin : '';
          const names = existing.split(',').map((n: string) => n.trim()).filter(Boolean);
          if (!names.includes(myName)) names.push(myName);
          return { ...m, read_status_admin: names.join(', ') };
        })
      );
      setIsDot(false);
    }
  }, [dispatch, getList, userId, userName]);

  const handleComposerInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [mentionCandidates.length]);

  const applyMention = useCallback((name: string) => {
    setKeyWord((prev) => {
      if (mentionStartIndex < 0) return prev;
      const before = prev.slice(0, mentionStartIndex);
      const after = prev.slice(mentionStartIndex + 1 + mentionQuery.length);
      return `${before}@[${name}] ${after}`;
    });
    setShowMention(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  }, [mentionStartIndex, mentionQuery]);

  const canSend =
    !!String(keyWord ?? '').trim() &&
    !!allTaskIds.length &&
    ((type === 1 && !!String(awb || '').trim()) || (type === 0 && !!String(number || '').trim()));

  const send = useCallback(async () => {
    const v = String(keyWord ?? '').trim();
    if (!v) return;
    if (!allTaskIds.length) return;
    if (type === 0 && !String(number || '').trim()) return;
    if (type === 1 && !String(awb || '').trim()) return;

    const mentions = extractMentions(v);
    const invalidMentions = mentions.filter(
      (m) => !allowedMentionNames.includes(m.toLowerCase())
    );
    if (invalidMentions.length > 0 && allowedMentionNames.length > 0) {
      alert('Only the assigned user and ticket owner can be mentioned');
      return;
    }

    try {
      await dispatch(
        postLeaveMessage({
          task_id: allTaskIds[0],
          user_id: userId,
          note_text: v,
          sender_type: senderLabel,
          container_number: type === 0 ? number || null : null,
          awb: type === 1 ? awb || null : null,
          read_status_admin: userName,
        }) as any
      );

      setKeyWord('');
      setShowMention(false);
      setMentionQuery('');
      setMentionStartIndex(-1);
      await getList();

      // Send email notification to client (fire-and-forget, silent on error)
      if (propUserId) {
        (async () => {
          try {
            const emailInfo = await fetchUserEmailApi(propUserId);
            const recipients = parseRecipientList(emailInfo?.email);
            if (!recipients.length) return;
            const { subject, text, html } = buildNoteEmail({
              lang: (emailInfo?.language ?? 0) as 0 | 1,
              bilingual: false,
              userName: emailInfo?.user_name,
              title,
              container: type === 0 ? number || undefined : undefined,
              awb: type === 1 ? awb || undefined : undefined,
              senderType: senderLabel,
              noteText: v.replace(/@\[(.*?)\]/g, '@$1'),
            });
            await sendMailApi({ to: recipients, subject, text, html });
          } catch (emailErr) {
            console.error('[LeaveMessageChat.send] email notify failed', emailErr);
          }
        })();
      }
    } catch (e) {
      console.error('[LeaveMessageChat.send] error', e);
    }
  }, [dispatch, allTaskIds, keyWord, userId, userName, senderLabel, type, number, awb, allowedMentionNames, getList, propUserId]);

  const searchMessages = () => {
    const searchInput = document.getElementById('lm-searchMessage') as HTMLInputElement | null;
    const filter = (searchInput?.value || '').toUpperCase();
    const ul = document.getElementById('lm-users-conversation') as HTMLElement | null;
    if (!ul) return;

    const li = ul.getElementsByTagName('li');
    Array.prototype.forEach.call(li, (node: HTMLElement) => {
      const p = node.getElementsByTagName('div')[0];
      const txt = (p?.textContent || p?.innerText || '').toUpperCase();
      node.style.display = txt.includes(filter) ? '' : 'none';
    });
  };

  return (
    <div className="lm-root">
      <div className="lm-trigger">
        <Button
          color="primary"
          className="lm-trigger__btn"
          onClick={openDrawer}
          disabled={disabledOpen}
        >
          {safeTT(tt, openKey, 'Leave Message')}
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
              <div className="lm-title">{title || safeTT(tt, openKey, 'Leave Message')}</div>
              <div className="lm-subtitle">
                {type === 0 ? (number ? `Container: ${number}` : '') : awb ? `AWB: ${awb}` : ''}
              </div>
            </div>

            <div className="lm-header__right">
              <Dropdown isOpen={searchOpen} toggle={() => setSearchOpen((v) => !v)}>
                <DropdownToggle
                  className="lm-iconBtn"
                  tag="button"
                  type="button"
                  aria-label="Search"
                >
                  <FeatherIcon icon="search" className="icon-sm" />
                </DropdownToggle>
                <DropdownMenu className="lm-menu lm-menu--search end-0">
                  <div className="lm-search">
                    <Input
                      id="lm-searchMessage"
                      onKeyUp={searchMessages}
                      type="text"
                      className="lm-search__input"
                      placeholder={safeTT(tt, 'common.search', 'Search...')}
                    />
                    <i className="ri-search-2-line lm-search__icon" />
                  </div>
                </DropdownMenu>
              </Dropdown>

              <Dropdown isOpen={settingsOpen} toggle={() => setSettingsOpen((v) => !v)}>
                <DropdownToggle className="lm-iconBtn" tag="button" type="button" aria-label="More">
                  <FeatherIcon icon="more-vertical" className="icon-sm" />
                </DropdownToggle>
                <DropdownMenu className="lm-menu end-0">
                  <button className="lm-menu__item" type="button" onClick={getList}>
                    <i className="ri-refresh-line align-bottom me-2" />
                    {safeTT(tt, 'common.refresh', 'Refresh')}
                  </button>
                  <button
                    className="lm-menu__item"
                    type="button"
                    onClick={() => setIsDrawer(false)}
                  >
                    <i className="ri-close-line align-bottom me-2" />
                    {safeTT(tt, 'common.close', 'Close')}
                  </button>
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>

          <div className="lm-content">
            {retrieving ? (
              <div className="lm-state">
                <Spinner size="sm" className="me-2" />
                {safeTT(tt, 'common.loading', 'Loading...')}
              </div>
            ) : (
              <SimpleBar ref={chatRef} className="lm-scroll">
                <div id={id} className="lm-scrollInner">
                  <ul className="lm-list" id="lm-users-conversation">
                    {list.length === 0 ? (
                      <li className="lm-empty">{safeTT(tt, 'common.noData', 'No data')}</li>
                    ) : (
                      list.map((m: any, idx: number) => {
                        const isMine = String(m.user_id) === String(userId);
                        return (
                          <li
                            key={m.note_id ?? idx}
                            className={`lm-row ${isMine ? 'is-mine' : 'is-other'}`}
                          >
                            <div className="lm-bubble">
                              <div className="lm-meta">
                                <span className="lm-sender">{m.note_sender}</span>
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
                    <div className="lm-mention-type">
                      {item.type === 'assigned' ? 'Assigned User' : 'Ticket Owner'}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Input
              type="textarea"
              rows={4}
              value={keyWord}
              onChange={handleComposerInput}
              placeholder={safeTT(tt, placeholderKey, 'Leave a message...')}
              className="lm-composer__input"
            />
            <div className="lm-composer__actions">
              <Button
                color="primary"
                className="lm-sendBtn"
                disabled={posting || !canSend}
                onClick={send}
              >
                {posting ? safeTT(tt, 'common.sending', 'Sending...') : safeTT(tt, sendKey, 'Send')}
              </Button>
            </div>
          </div>
        </OffcanvasBody>
      </Offcanvas>
    </div>
  );
}
