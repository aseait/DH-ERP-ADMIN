import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, ModalBody, ModalHeader } from 'reactstrap';
import { useTT } from '../../helpers/useTT';

/**
 * Reusable file picker used across the app (SOP library, and anywhere else that
 * needs "choose 1..N files" with drag & drop, size limits and an inline preview).
 *
 * Always works with a `File[]`; pass `maxFiles={1}` for a single-file field.
 */

export type FileUploadPickerProps = {
  id: string;
  label: string;
  /** input `accept` attribute, e.g. "video/*" or ".pdf,.docx" */
  accept: string;
  files: File[];
  onChange: (files: File[]) => void;
  /** 1 = single-file field (a new pick replaces the current one). Default: unlimited. */
  maxFiles?: number;
  /** per-file size cap in bytes; oversized files are rejected with a message. */
  maxSizeBytes?: number;
  disabled?: boolean;
  required?: boolean;
  /** small helper line under the dropzone */
  hint?: string;
};

const humanSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  return `${val.toFixed(i === 0 || val >= 10 ? 0 : 1)} ${units[i]}`;
};

const isImage = (f: File) => f.type.startsWith('image/');
const isVideo = (f: File) => f.type.startsWith('video/');
const isPdf = (f: File) => f.type === 'application/pdf';
const canPreview = (f: File) => isImage(f) || isVideo(f) || isPdf(f);

const FileUploadPicker: React.FC<FileUploadPickerProps> = ({
  id,
  label,
  accept,
  files,
  onChange,
  maxFiles = Infinity,
  maxSizeBytes,
  disabled,
  required,
  hint,
}) => {
  const { tt } = useTT();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  // Object URLs for the preview modal — created lazily, revoked on close/unmount.
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const single = maxFiles === 1;

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (disabled || incoming.length === 0) return;
      let accepted = incoming;
      let rejected = 0;
      if (maxSizeBytes) {
        accepted = incoming.filter((f) => f.size <= maxSizeBytes);
        rejected = incoming.length - accepted.length;
      }
      if (accepted.length === 0) {
        setError(
          rejected > 0
            ? tt('fileUpload.tooLarge', { size: humanSize(maxSizeBytes || 0) })
            : ''
        );
        return;
      }

      const next = single
        ? [accepted[0]]
        : [...files, ...accepted]
            // de-dupe by name + size so re-picking the same file is a no-op
            .filter(
              (f, i, arr) => arr.findIndex((o) => o.name === f.name && o.size === f.size) === i
            )
            .slice(0, maxFiles);

      setError(rejected > 0 ? tt('fileUpload.tooLarge', { size: humanSize(maxSizeBytes || 0) }) : '');
      onChange(next);
    },
    [disabled, files, maxFiles, maxSizeBytes, onChange, single, tt]
  );

  const removeAt = (idx: number) => onChange(files.filter((_, i) => i !== idx));

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const atLimit = files.length >= maxFiles;

  return (
    <div className="file-upload-picker mb-3">
      <div className="d-flex align-items-center justify-content-between mb-1">
        <label htmlFor={id} className="form-label mb-0">
          {label}
          {required ? <span className="text-danger ms-1">*</span> : null}
        </label>
        <Button
          color="primary"
          outline
          size="sm"
          type="button"
          onClick={openPicker}
          disabled={disabled || (atLimit && !single)}
        >
          {tt('fileUpload.choose')}
        </Button>
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={!single}
        disabled={disabled}
        style={{ display: 'none' }}
        onChange={(e) => {
          addFiles(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />

      <div
        className={`file-upload-dropzone${isDragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
        onClick={openPicker}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          addFiles(Array.from(e.dataTransfer.files || []));
        }}
        role="button"
        tabIndex={0}
      >
        {disabled
          ? tt('fileUpload.disabled')
          : atLimit && !single
          ? tt('fileUpload.limitReached', { count: maxFiles })
          : tt('fileUpload.dragOrClick')}
      </div>

      {hint ? <div className="text-muted small mt-1">{hint}</div> : null}
      {error ? <div className="text-danger small mt-1">{error}</div> : null}

      {files.length > 0 && (
        <ul className="list-unstyled small mt-2 mb-0">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className="d-flex align-items-center gap-2 mb-1">
              <i className="ri-attachment-2" />
              {canPreview(f) ? (
                <Button
                  size="sm"
                  color="link"
                  className="p-0 text-truncate"
                  style={{ maxWidth: 260 }}
                  type="button"
                  onClick={() => setPreview({ url: URL.createObjectURL(f), file: f })}
                >
                  {f.name}
                </Button>
              ) : (
                <span className="text-truncate" style={{ maxWidth: 260 }}>
                  {f.name}
                </span>
              )}
              <span className="text-muted">{humanSize(f.size)}</span>
              {!disabled && (
                <Button
                  size="sm"
                  color="link"
                  className="p-0 text-danger"
                  type="button"
                  onClick={() => removeAt(i)}
                  title={tt('fileUpload.remove')}
                >
                  <i className="ri-close-line" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={!!preview} toggle={() => setPreview(null)} centered size="lg">
        <ModalHeader toggle={() => setPreview(null)}>{preview?.file.name}</ModalHeader>
        <ModalBody className="text-center">
          {preview && isImage(preview.file) && (
            <img src={preview.url} alt={preview.file.name} className="img-fluid" />
          )}
          {preview && isVideo(preview.file) && (
            <video src={preview.url} controls style={{ width: '100%', maxHeight: '70vh' }} />
          )}
          {preview && isPdf(preview.file) && (
            <iframe
              src={preview.url}
              title={preview.file.name}
              style={{ width: '100%', height: '75vh', border: 0 }}
            />
          )}
        </ModalBody>
      </Modal>
    </div>
  );
};

export default FileUploadPicker;
