import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, Spinner } from 'reactstrap';

type FileRow = {
  file_url?: string;
  fileName?: string;
  original_file_name?: string;
};

export default function CadConfirmModal({
  tt,
  isOpen,
  onClose,
  cadFile,
  cadStatus,
  setCadStatus,
  cadNote,
  setCadNote,
  onPreviewFile,
  onSubmit,
  submitting,
}: {
  tt: (k: string) => string;
  isOpen: boolean;
  onClose: () => void;
  cadFile: FileRow | null;
  cadStatus: number;
  setCadStatus: (v: number) => void;
  cadNote: string;
  setCadNote: (v: string) => void;
  onPreviewFile: (url?: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const showNote = cadStatus === 3;

  return (
    <Modal isOpen={isOpen} toggle={onClose} centered>
      <ModalHeader toggle={onClose}>{tt('common.confirm')} CAD</ModalHeader>

      <ModalBody>
        <div className="md-modalText">
          {cadFile?.file_url ? (
            <button
              type="button"
              className="md-link"
              onClick={() => cadFile?.file_url && onPreviewFile(cadFile.file_url)}
            >
              {cadFile.fileName || cadFile.original_file_name || tt('actions.viewFile')}
            </button>
          ) : (
            <span className="md-muted">{tt('common.noData')}</span>
          )}
        </div>

        <div className="mt-3">
          <div className="md-radioRow">
            <label className="md-radio">
              <input type="radio" checked={cadStatus === 2} onChange={() => setCadStatus(2)} />
              <span>{tt('state.cad.agree')}</span>
            </label>

            <label className="md-radio">
              <input type="radio" checked={cadStatus === 3} onChange={() => setCadStatus(3)} />
              <span>{tt('state.cad.rejected')}</span>
            </label>
          </div>

          {showNote ? (
            <Input
              className="mt-2"
              placeholder={tt('state.cad.rejectReason')}
              value={cadNote}
              onChange={(e) => setCadNote(e.target.value)}
            />
          ) : null}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button className="md-btn md-btn--ghost" onClick={onClose} disabled={submitting}>
          {tt('uploadMarine.actions.cancel')}
        </Button>

        <Button className="md-btn md-btn--primary" onClick={onSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Spinner size="sm" className="me-2" /> {tt('ticketSummary.loading')}
            </>
          ) : (
            tt('common.confirm')
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
