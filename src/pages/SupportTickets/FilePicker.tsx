import React, { useRef, useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalHeader } from 'reactstrap';
import { useTT } from '../../helpers/useTT';
import {
  formatFileSize,
  SUPPORT_FILE_ACCEPT,
  SUPPORT_FILE_MAX_COUNT,
  SUPPORT_FILE_MAX_SIZE_BYTES,
  TicketFile,
} from './ticketMeta';

const isPreviewableMime = (mime?: string | null): boolean =>
  !!mime && (mime.startsWith('image/') || mime === 'application/pdf');

type Preview = { url: string; mimeType: string | null; name: string; revokeOnClose?: boolean };

// Shared inline preview for image/PDF attachments — avoids forcing a download/new tab for common types.
const FilePreviewModal: React.FC<{ preview: Preview | null; onClose: () => void }> = ({ preview, onClose }) => (
  <Modal isOpen={!!preview} toggle={onClose} centered size="lg">
    <ModalHeader toggle={onClose}>{preview?.name}</ModalHeader>
    <ModalBody className="text-center">
      {preview?.mimeType?.startsWith('image/') && (
        <img src={preview.url} alt={preview.name} className="img-fluid" />
      )}
      {preview?.mimeType === 'application/pdf' && (
        <iframe src={preview.url} title={preview.name} style={{ width: '100%', height: '75vh', border: 0 }} />
      )}
    </ModalBody>
  </Modal>
);

// Append `incoming` to `existing`, dropping anything over the size cap and
// keeping the total within SUPPORT_FILE_MAX_COUNT.
export const mergeAttachments = (existing: File[], incoming: File[]): File[] =>
  [...existing, ...incoming.filter((f) => f.size <= SUPPORT_FILE_MAX_SIZE_BYTES)].slice(0, SUPPORT_FILE_MAX_COUNT);

// Pull image files out of a paste event (e.g. a screenshot copied to the clipboard).
// Clipboard images usually arrive named "image.png", so give them a unique name.
export const imageFilesFromClipboard = (e: React.ClipboardEvent): File[] => {
  const out: File[] = [];
  const items = e.clipboardData?.items;
  if (!items) return out;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (!file) continue;
    const hasRealName = file.name && file.name.toLowerCase() !== 'image.png';
    if (hasRealName) {
      out.push(file);
    } else {
      const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      out.push(new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type }));
    }
  }
  return out;
};

type FilePickerProps = {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
};

// Lightweight multi-file picker for ticket attachments (Description / Solution).
export const FilePicker: React.FC<FilePickerProps> = ({ files, onChange, disabled }) => {
  const { tt } = useTT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(mergeAttachments(files, Array.from(e.target.files || [])));
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (idx: number) => onChange(files.filter((_, i) => i !== idx));

  const openPreview = (f: File) => {
    setPreview({ url: URL.createObjectURL(f), mimeType: f.type || null, name: f.name, revokeOnClose: true });
  };

  const closePreview = () => {
    setPreview((p) => {
      if (p?.revokeOnClose) URL.revokeObjectURL(p.url);
      return null;
    });
  };

  const atLimit = files.length >= SUPPORT_FILE_MAX_COUNT;

  return (
    <div>
      {!disabled && (
        <Input
          innerRef={inputRef}
          type="file"
          multiple
          bsSize="sm"
          accept={SUPPORT_FILE_ACCEPT}
          disabled={atLimit}
          onChange={handlePick}
        />
      )}
      {files.length > 0 && (
        <ul className="list-unstyled small mt-2 mb-0">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="d-flex align-items-center gap-2 mb-1">
              <i className="ri-attachment-2" />
              {isPreviewableMime(f.type) ? (
                <Button size="sm" color="link" className="p-0 text-truncate" style={{ maxWidth: 240 }} onClick={() => openPreview(f)}>
                  {f.name}
                </Button>
              ) : (
                <span className="text-truncate" style={{ maxWidth: 240 }}>
                  {f.name}
                </span>
              )}
              <span className="text-muted">{formatFileSize(f.size)}</span>
              {!disabled && (
                <Button
                  size="sm"
                  color="link"
                  className="p-0 text-danger"
                  onClick={() => removeAt(i)}
                  title={tt('common.delete')}
                >
                  <i className="ri-close-line" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <FilePreviewModal preview={preview} onClose={closePreview} />
    </div>
  );
};

export const ExistingFileList: React.FC<{ files?: TicketFile[] }> = ({ files }) => {
  const [preview, setPreview] = useState<Preview | null>(null);

  if (!files || files.length === 0) return null;

  return (
    <>
      <ul className="list-unstyled small mb-0 mt-1">
        {files.map((f) => (
          <li key={f.file_id} className="d-flex align-items-center gap-2">
            {isPreviewableMime(f.mime_type) ? (
              <Button
                size="sm"
                color="link"
                className="p-0 text-start"
                onClick={() => setPreview({ url: f.file_url, mimeType: f.mime_type, name: f.original_file_name })}
              >
                <i className="ri-attachment-2 align-middle me-1" />
                {f.original_file_name}
              </Button>
            ) : (
              <a href={f.file_url} target="_blank" rel="noreferrer">
                <i className="ri-attachment-2 align-middle me-1" />
                {f.original_file_name}
              </a>
            )}
            <a href={f.file_url} target="_blank" rel="noreferrer" className="text-muted" title="Open / Download">
              <i className="ri-download-2-line" />
            </a>
          </li>
        ))}
      </ul>
      <FilePreviewModal preview={preview} onClose={() => setPreview(null)} />
    </>
  );
};
