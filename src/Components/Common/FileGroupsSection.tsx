import React from 'react';
import { Card, CardBody, Button, Collapse, Spinner } from 'reactstrap';
import type { FileGroup, FileRow } from '../../pages/OrderLists/OrderDetails/MarineDetails';

const SectionHeader = ({
                           title,
                           open,
                           onToggle,
                           right,
                       }: {
    title: string;
    open: boolean;
    onToggle: () => void;
    right?: React.ReactNode;
}) => (
    <div className="md-sectionHead">
        <button type="button" className="md-sectionHead__toggle" onClick={onToggle}>
            <span className={`md-chevron ${open ? 'open' : ''}`} />
            <span className="md-sectionHead__title">{title}</span>
        </button>
        <div className="md-sectionHead__right">{right}</div>
    </div>
);

export default function FileGroupsSection({
                                              tt,
                                              open,
                                              onToggle,
                                              canEdit,
                                              canDelete,
                                              fileGroups,
                                              retrievingFiles,
                                              uploadingMarineAir,
                                              onAddFile,
                                              onReplaceFile,
                                              onDeleteFile,
                                              onPreviewFile,
                                              addInputRef,
                                              replaceInputRef,
                                              onAddChange,
                                              onReplaceChange,
                                              title,
                                          }: {
    tt: (k: string) => string;
    open: boolean;
    onToggle: () => void;
    canEdit: boolean;
    canDelete?: boolean;
    fileGroups: FileGroup[];
    retrievingFiles: boolean;
    uploadingMarineAir: boolean;
    onAddFile: (groupKey: string) => void;
    onReplaceFile: (file: FileRow, groupKey: string) => void;
    onDeleteFile?: (file: FileRow) => void;
    onPreviewFile: (url?: string) => void;
    addInputRef: React.RefObject<HTMLInputElement | null>;
    replaceInputRef: React.RefObject<HTMLInputElement | null>;
    onAddChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onReplaceChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    title?: string;
}) {
    return (
        <Card className="md-section">
            <SectionHeader
                title={title ?? tt('files.title')}
                open={open}
                onToggle={onToggle}
                right={
                    <div className="md-headRight">
                        {retrievingFiles ? <Spinner size="sm" className="me-2" /> : null}
                        {uploadingMarineAir ? <Spinner size="sm" className="me-2" /> : null}
                    </div>
                }
            />

            <Collapse isOpen={open}>
                <CardBody className="md-section__body">
                    <div className="md-filesGrid">
                        {fileGroups.map((g) => (
                            <div className="md-fileGroup" key={g.key}>
                                <div className="md-fileGroup__head">
                                    <div className="md-fileGroup__title">{g.key}</div>

                                    {canEdit ? (
                                        <Button
                                            size="sm"
                                            className="md-btn md-btn--soft"
                                            disabled={uploadingMarineAir}
                                            onClick={() => onAddFile(g.key)}
                                        >
                                            {uploadingMarineAir ? tt('ticketSummary.loading') : tt('files.add')}
                                        </Button>
                                    ) : null}
                                </div>

                                <div className="md-fileGroup__body">
                                    {g.value.length === 0 ? (
                                        <div className="md-empty">
                                            <div className="md-empty__icon">📄</div>
                                            <div className="md-empty__text">{tt('common.noData')}</div>
                                        </div>
                                    ) : (
                                        g.value.map((f, i) => (
                                            <div className="md-fileRow" key={`${g.key}_${i}`}>
                                                <div className="md-fileRow__left">
                                                    <button
                                                        type="button"
                                                        className="md-link"
                                                        disabled={!f.file_url}
                                                        onClick={() => f.file_url && onPreviewFile(f.file_url)}
                                                    >
                                                        {f.original_file_name || f.fileName || tt('actions.viewFile')}
                                                    </button>
                                                    {f.note ? <div className="md-muted small">({f.note})</div> : null}
                                                </div>

                                                <div className="md-fileRow__actions">
                                                    {canEdit ? (
                                                        <Button
                                                            size="sm"
                                                            className="md-btn md-btn--soft"
                                                            disabled={uploadingMarineAir}
                                                            onClick={() => onReplaceFile(f, g.key)}
                                                        >
                                                            {uploadingMarineAir ? tt('ticketSummary.loading') : tt('files.replace')}
                                                        </Button>
                                                    ) : null}

                                                    {canDelete && onDeleteFile ? (
                                                        <Button
                                                            size="sm"
                                                            className="md-btn md-btn--danger"
                                                            disabled={uploadingMarineAir}
                                                            onClick={() => onDeleteFile(f)}
                                                        >
                                                            Delete
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <input
                        ref={replaceInputRef}
                        type="file"
                        style={{ display: 'none' }}
                        onChange={onReplaceChange}
                    />
                    <input ref={addInputRef} type="file" style={{ display: 'none' }} onChange={onAddChange} />
                </CardBody>
            </Collapse>
        </Card>
    );
}
