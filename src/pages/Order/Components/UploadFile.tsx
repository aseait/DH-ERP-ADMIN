import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Card, CardBody, Button } from 'reactstrap';
import { useTT } from '../../../helpers/useTT';

export type UploadFileProps = {
  id?: string;

  // Display title for the upload block
  title: string;

  // Whether this file category is required
  required?: boolean;

  // Current selected files for this category (controlled by parent)
  value: File[];

  // Called with ONLY "new files"
  onChange: (files: File[]) => void;

  // Remove one file by index
  onRemove: (index: number) => void;

  // Disable all interactions
  disabled?: boolean;
};

// FILE TYPE VALIDATION

// Allowed MIME types (browser File.type)
const ALLOWED_MIME = new Set<string>([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
]);

// Allowed file extensions
const ALLOWED_EXT = new Set<string>(['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx']);

/**
 * Extract extension from filename
 */
function getExt(name: string) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;

const UploadFile: React.FC<UploadFileProps> = ({
  id,
  title,
  required = false,
  value,
  onChange,
  onRemove,
  disabled,
}) => {
  const { tt } = useTT();

  // Reference to hidden native <input type="file" />
  const nativeInputRef = useRef<HTMLInputElement | null>(null);

  // Drag UI state (highlight dropzone)
  const [isDragging, setIsDragging] = useState(false);

  // Generate stable input id (useful for label/test hooks)
  const inputId = useMemo(() => (id ? `uploadfile-${id}` : undefined), [id]);

  /**
   * Throw an error if the given file type is not allowed.
   * Uses bilingual
   */
  const assertFileAllowed = useCallback(
    (file: File) => {
      const ext = getExt(file.name);
      const mime = file.type || '';
      const ok = ALLOWED_EXT.has(ext) || ALLOWED_MIME.has(mime);

      if (!ok) {
        // bilingual message
        throw new Error(
          tt('uploadFile.errors.invalidType', {
            name: file.name,
            mime: mime || tt('uploadFile.unknown'),
            ext: ext ? `.${ext}` : tt('uploadFile.unknown'),
          })
        );
      }
    },
    [tt]
  );

  /**
   * Validate incoming files, remove duplicates, then forward to parent
   * Parent is responsible for merging into its state
   */
  const acceptAndSend = useCallback(
    (files: File[]) => {
      if (disabled) return;
      if (!files.length) return;

      const accepted: File[] = [];
      try {
        // Validate each file
        for (const f of files) {
          assertFileAllowed(f);
          accepted.push(f);
        }
      } catch (err: any) {
        // Show validation message (keep simple alert)
        alert(err?.message || tt('uploadFile.errors.invalidFile'));
        return;
      }

      // prevent duplicates against current value
      const existing = new Set((value || []).map(fileKey));
      const newOnly = accepted.filter((f) => !existing.has(fileKey(f)));

      if (newOnly.length) onChange(newOnly);
    },
    [disabled, onChange, value, assertFileAllowed, tt]
  );

  /**
   * Native file picker handler.
   */
  const handlePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      acceptAndSend(files);
      e.target.value = ''; // allow picking same file again later
    },
    [acceptAndSend]
  );

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      setIsDragging(true);
    },
    [disabled]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      // show "copy" cursor/intent
      e.dataTransfer.dropEffect = 'copy';
      setIsDragging(true);
    },
    [disabled]
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;

      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files || []);
      acceptAndSend(files);
    },
    [acceptAndSend, disabled]
  );

  const openPicker = useCallback(() => {
    if (disabled) return;
    nativeInputRef.current?.click();
  }, [disabled]);

  return (
    <Card className="uf-card mb-3">
      <CardBody
        // Visual state based on dragging/disabled
        className={`uf-body ${isDragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Header: title + choose files button */}
        <div className="uf-head">
          <div className="uf-title">
            {title}
            {required ? <span className="uf-required">*</span> : null}
          </div>

          {/* Hidden native file input (triggered by button/click on dropzone) */}
          <input
            ref={nativeInputRef}
            id={inputId}
            className="uf-hidden-input"
            type="file"
            multiple
            disabled={disabled}
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
            onChange={handlePick}
          />

          <Button
            color="primary"
            outline
            type="button"
            className="uf-pick-btn"
            onClick={openPicker}
            disabled={disabled}
          >
            {tt('uploadFile.actions.chooseFiles')}
          </Button>
        </div>

        {/* Dropzone: click to open picker, or drag & drop files */}
        <div className="uf-dropzone" onClick={openPicker} role="button" tabIndex={0}>
          {disabled
            ? tt('uploadFile.dropzone.disabled')
            : isDragging
              ? tt('uploadFile.dropzone.dropToAdd')
              : tt('uploadFile.dropzone.dragOrClick')}
        </div>

        {/* Selected files list */}
        {value?.length ? (
          <ul className="uf-list">
            {value.map((f, idx) => (
              <li className="uf-item" key={`${f.name}-${f.size}-${f.lastModified}-${idx}`}>
                <div className="uf-name">{f.name}</div>
                <Button
                  size="sm"
                  color="danger"
                  outline
                  disabled={disabled}
                  onClick={() => onRemove(idx)}
                >
                  {tt('uploadFile.actions.remove')}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="uf-empty">{tt('uploadFile.empty')}</div>
        )}
      </CardBody>
    </Card>
  );
};

export default UploadFile;
