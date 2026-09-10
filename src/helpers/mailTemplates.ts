export type CadNotifyKind = 'draft' | 'release';
export type Lang = 0 | 1;

interface CadNotifyInput {
  kind: CadNotifyKind;
  lang?: Lang;
  userName?: string;
  identifier?: string | number;
  identifierKind?: 'container' | 'awb';
  jobId?: string | number;
  currency?: string;
  dutiesAndTaxes?: number | string | null;
}

export function buildCadEmail({
  kind,
  lang = 0,
  userName,
  identifier,
  identifierKind = 'container',
  jobId,
  currency,
  dutiesAndTaxes,
}: CadNotifyInput) {
  const isZh = lang === 1;
  const idValue = String(identifier ?? '');
  const idLabel = isZh
    ? identifierKind === 'awb' ? '运单号' : '集装箱'
    : identifierKind === 'awb' ? 'AWB' : 'Container';

  const titleEN = kind === 'draft' ? 'Draft CAD Uploaded' : 'Release CAD Uploaded';
  const titleZH = kind === 'draft' ? '已上传草稿 CAD' : '已上传放行 CAD';
  const title = isZh ? titleZH : titleEN;
  const subject = `${title} - ${idValue}`.trim();

  const moneyLine =
    dutiesAndTaxes != null && dutiesAndTaxes !== ''
      ? isZh
        ? `\n关税/税费：${currency || 'CA$'}${dutiesAndTaxes}`
        : `\nDuties/Taxes: ${currency || 'CA$'}${dutiesAndTaxes}`
      : '';

  const noReplyLine = isZh ? '请勿直接回复此邮件。' : 'Please do not reply to this email.';
  const checkStatusLine =
    kind === 'draft'
      ? isZh ? '请在系统中查看并确认 CAD。' : 'Please check and confirm the CAD in the system.'
      : '';

  const lines = isZh
    ? [
        `您好 ${userName || ''}：`, '',
        `${title}（${idLabel}：${idValue}）。`,
        `工作单号：${jobId ?? ''}`, moneyLine, '',
        ...(checkStatusLine ? [checkStatusLine] : []),
        noReplyLine, '', '此致', 'DH Supply Chain Inc',
      ]
    : [
        `Hello ${userName || ''},`, '',
        `${title} for ${idLabel.toLowerCase()} ${idValue}.`,
        `Job ID: ${jobId ?? ''}`, moneyLine, '',
        ...(checkStatusLine ? [checkStatusLine] : []),
        noReplyLine, '', 'Best regards,', 'DH Supply Chain Inc',
      ];

  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n');

  const htmlMoney =
    dutiesAndTaxes != null && dutiesAndTaxes !== ''
      ? isZh
        ? `<p>关税/税费：<strong>${currency || 'CA$'}${dutiesAndTaxes}</strong></p>`
        : `<p>Duties/Taxes: <strong>${currency || 'CA$'}${dutiesAndTaxes}</strong></p>`
      : '';

  const htmlCheck = checkStatusLine ? `<p><em>${checkStatusLine}</em></p>` : '';

  const html = isZh
    ? `<div style="font-family:Arial,sans-serif;line-height:1.5"><p>您好 ${userName || ''}：</p><p><strong>${title}</strong>（${idLabel}：<strong>${idValue}</strong>）。</p>${htmlMoney}${htmlCheck}<p><em>${noReplyLine}</em></p><p>此致<br/>DH Supply Chain Inc</p></div>`
    : `<div style="font-family:Arial,sans-serif;line-height:1.5"><p>Hello ${userName || ''},</p><p><strong>${title}</strong> for ${idLabel.toLowerCase()} <strong>${idValue}</strong>.</p>${htmlMoney}${htmlCheck}<p><em>${noReplyLine}</em></p><p>Best regards,<br/>DH Supply Chain Inc</p></div>`;

  return { subject, text, html };
}

interface NoteEmailInput {
  lang?: Lang;
  bilingual?: boolean;
  userName?: string;
  title?: string;
  awb?: string;
  container?: string;
  senderType?: string;
  noteText: string;
}

export function buildNoteEmail(opts: NoteEmailInput) {
  const isZh = opts.lang === 1;
  const idLineZh = opts.awb ? `AWB：${opts.awb}` : `集装箱：${opts.container || ''}`;
  const idLineEn = opts.awb ? `AWB: ${opts.awb}` : `Container: ${opts.container || ''}`;
  const subjectBase = opts.awb || opts.container || opts.title || '';
  const subject =
    (opts.bilingual ? 'New message / 有新的留言' : isZh ? '有新的留言' : 'New message') +
    (subjectBase ? ` - ${subjectBase}` : '');

  const headerZh = `您好 ${opts.userName || ''}：`;
  const headerEn = `Hello ${opts.userName || ''},`;
  const bodyLineZh = `您收到来自「${opts.senderType || '系统'}」的新留言：`;
  const bodyLineEn = `You received a new message from "${opts.senderType || 'System'}":`;
  const safeNote = (opts.noteText || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (opts.bilingual) {
    const text = [
      headerEn, '', bodyLineEn, '', `"${opts.noteText}"`, '', idLineEn, '',
      'Please check the status in the system.', 'Please do not reply to this email.',
      '', 'Best regards,', 'DH Supply Chain Inc', '', '------------------------------', '',
      headerZh, '', bodyLineZh, '', `"${opts.noteText}"`, '', idLineZh, '',
      '请在系统中查看状态。', '请勿直接回复此邮件。', '', '此致', 'DH Supply Chain Inc',
    ].join('\n');

    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6"><p>${headerEn}</p><p>${bodyLineEn}</p><blockquote style="margin:10px 0;padding:10px;border-left:3px solid #ddd;background:#fafafa;white-space:pre-wrap;">${safeNote}</blockquote><p><em>Please check the status in the system.</em><br/><em>Please do not reply to this email.</em></p><p>Best regards,<br/>DH Supply Chain Inc</p><hr style="margin:20px 0;border:none;border-top:1px solid #eee"/><p>${headerZh}</p><p>${bodyLineZh}</p><blockquote style="margin:10px 0;padding:10px;border-left:3px solid #ddd;background:#fafafa;white-space:pre-wrap;">${safeNote}</blockquote><p><em>请在系统中查看状态。</em><br/><em>请勿直接回复此邮件。</em></p><p>此致<br/>DH Supply Chain Inc</p></div>`;

    return { subject, text, html };
  }

  const text = isZh
    ? [headerZh, '', bodyLineZh, '', `"${opts.noteText}"`, '', idLineZh, '', '请在系统中查看状态。', '请勿直接回复此邮件。', '', '此致', 'DH Supply Chain Inc'].join('\n')
    : [headerEn, '', bodyLineEn, '', `"${opts.noteText}"`, '', idLineEn, '', 'Please check the status in the system.', 'Please do not reply to this email.', '', 'Best regards,', 'DH Supply Chain Inc'].join('\n');

  const html = isZh
    ? `<div style="font-family:Arial,sans-serif;line-height:1.6"><p>${headerZh}</p><p>${bodyLineZh}</p><blockquote style="margin:10px 0;padding:10px;border-left:3px solid #ddd;background:#fafafa;white-space:pre-wrap;">${safeNote}</blockquote><p><em>请在系统中查看状态。</em><br/><em>请勿直接回复此邮件。</em></p><p>此致<br/>DH Supply Chain Inc</p></div>`
    : `<div style="font-family:Arial,sans-serif;line-height:1.6"><p>${headerEn}</p><p>${bodyLineEn}</p><blockquote style="margin:10px 0;padding:10px;border-left:3px solid #ddd;background:#fafafa;white-space:pre-wrap;">${safeNote}</blockquote><p><em>Please check the status in the system.</em><br/><em>Please do not reply to this email.</em></p><p>Best regards,<br/>DH Supply Chain Inc</p></div>`;

  return { subject, text, html };
}

export function parseRecipientList(input?: string | string[] | null): string[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : [input];
  const parts = raw.flatMap((s) => String(s).split(/[,\s;，]+/g)).map((s) => s.trim()).filter(Boolean);
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (emailRx.test(p) && !seen.has(k)) { seen.add(k); out.push(p); }
  }
  return out;
}
