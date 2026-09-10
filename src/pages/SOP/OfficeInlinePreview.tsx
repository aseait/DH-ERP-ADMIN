import React, { useEffect, useState } from 'react';
import { Spinner } from 'reactstrap';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { useTT } from '../../helpers/useTT';
import { resolvePreviewUrl } from '../../helpers/filePreview';
import { fetchSopFileBytes } from '../../helpers/api_fetch/sop';
import { SopFile } from './sopConfig';

/**
 * Renders Word (.docx) and Excel (.xlsx/.xls/.csv) SOP documents *in the browser* —
 * no third-party viewer. The file bytes are fetched client-side (needs the OSS
 * host to allow a CORS request from this origin), then:
 *   - .docx      -> HTML via mammoth
 *   - .xlsx/.xls -> one HTML table per sheet via SheetJS
 * Anything that can't be rendered (legacy .doc, .ppt, a CORS-blocked fetch)
 * falls back to a download panel.
 */

const extOf = (name: string): string => {
  const m = /\.([a-z0-9]+)(?:\?|#|$)/i.exec(name || '');
  return m ? m[1].toLowerCase() : '';
};

// mammoth / SheetJS don't emit scripts, but the source is a user-uploaded file —
// strip the obvious script vectors before injecting the HTML.
const sanitize = (html: string): string =>
  html
    .replace(/<\s*(script|iframe|object|embed|link|meta)\b[^>]*>/gi, '')
    .replace(/<\s*\/\s*(script|iframe|object|embed)\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')?\s*javascript:[^"'>\s]*/gi, '$1="#"');

type RenderState =
  | { status: 'loading' }
  | { status: 'excel'; sheets: { name: string; html: string }[] }
  | { status: 'word'; html: string }
  | { status: 'error' };

// Prefer the API proxy (sends CORS headers, so it always works); fall back to a
// direct OSS fetch for setups where the bucket already allows cross-origin reads.
const fetchBytes = async (f: SopFile): Promise<ArrayBuffer> => {
  try {
    return await fetchSopFileBytes(f.fileId);
  } catch {
    /* proxy unavailable — try the file URL directly */
  }
  const urls = Array.from(new Set([resolvePreviewUrl(f.fileUrl), f.fileUrl].filter(Boolean)));
  let lastErr: unknown;
  for (const u of urls) {
    try {
      const res = await fetch(u);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.arrayBuffer();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
};

const OfficeInlinePreview: React.FC<{ f: SopFile }> = ({ f }) => {
  const { tt } = useTT();
  const [state, setState] = useState<RenderState>({ status: 'loading' });
  const [activeSheet, setActiveSheet] = useState(0);

  const ext = extOf(f.originalFileName) || extOf(f.fileUrl);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setActiveSheet(0);

    fetchBytes(f)
      .then(async (buf) => {
        if (cancelled) return;
        if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
          const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
          const sheets = wb.SheetNames.map((name) => ({
            name,
            html: sanitize(XLSX.utils.sheet_to_html(wb.Sheets[name])),
          }));
          setState({ status: 'excel', sheets });
        } else if (ext === 'docx') {
          const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
          setState({ status: 'word', html: sanitize(value) });
        } else {
          setState({ status: 'error' }); // .doc / .ppt / .pptx — can't render
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [f.fileId, f.fileUrl, f.originalFileName, ext]);

  if (state.status === 'loading') {
    return (
      <div className="mt-2 text-center py-4">
        <Spinner size="sm" color="primary" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="mt-2 border rounded bg-light text-center py-4 px-3">
        <i className="ri-file-text-line fs-3 text-muted d-block mb-2" />
        <div className="text-muted small mb-2">{tt('sop.details.officeNoPreview')}</div>
        <a href={f.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">
          <i className="ri-download-2-line align-bottom me-1" />
          {tt('sop.details.download')}
        </a>
      </div>
    );
  }

  if (state.status === 'excel') {
    const sheet = state.sheets[activeSheet] || state.sheets[0];
    return (
      <div className="mt-2 border rounded">
        {state.sheets.length > 1 && (
          <div className="d-flex flex-wrap gap-1 border-bottom bg-light p-1">
            {state.sheets.map((s, i) => (
              <button
                key={s.name}
                type="button"
                className={`btn btn-sm ${i === activeSheet ? 'btn-primary' : 'btn-light'}`}
                onClick={() => setActiveSheet(i)}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
        <div
          className="sop-xls-preview"
          dangerouslySetInnerHTML={{ __html: sheet?.html || '' }}
        />
      </div>
    );
  }

  // word
  return (
    <div
      className="mt-2 border rounded sop-doc-preview"
      dangerouslySetInnerHTML={{ __html: state.html }}
    />
  );
};

export default OfficeInlinePreview;
