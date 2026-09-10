import React from 'react';
import { Button, Card, CardBody, Collapse, Spinner, Alert, Badge } from 'reactstrap';
import { safeStr } from '../helper';

export type ReadOnlyFileRow = {
    file_id?: any;
    file_url?: string;
    original_file_name?: string;
    fileName?: string;
    note?: string;
};

export type ReadOnlyFileGroup = {
    key: string;
    value: ReadOnlyFileRow[];
};

type ReadOnlyFileGroupsSectionProps = {
    title: string;
    groups: ReadOnlyFileGroup[];
    open: boolean;
    onToggle: () => void;
    tt: (key: string, options?: any) => string;
    onPreviewFile: (url?: string) => void;
    retrievingFiles?: boolean;
    emptyText?: string;
};

const ReadOnlyFileGroupsSection = ({
                                       title,
                                       groups,
                                       open,
                                       onToggle,
                                       tt,
                                       onPreviewFile,
                                       retrievingFiles = false,
                                       emptyText,
                                   }: ReadOnlyFileGroupsSectionProps) => {
    const hasAnyFiles = groups.some((g) => Array.isArray(g.value) && g.value.length > 0);

    return (
        <Card className="md-section">
            <div className="md-sectionHead">
                <button
                    type="button"
                    className="md-sectionHead__toggle"
                    onClick={onToggle}
                >
                    <span className={`md-chevron ${open ? 'open' : ''}`} />
                    <span className="md-sectionHead__title">{title}</span>
                </button>
            </div>

            <Collapse isOpen={open}>
                <CardBody className="md-section__body">
                    {retrievingFiles ? (
                        <div className="d-flex align-items-center gap-2">
                            <Spinner size="sm" />
                            <span>{tt('ticketSummary.loading')}</span>
                        </div>
                    ) : !hasAnyFiles ? (
                        <Alert color="light" className="mb-0">
                            {emptyText || tt('common.noData')}
                        </Alert>
                    ) : (
                        groups.map((group) => (
                            <div className="md-item" key={group.key}>
                                <div className="md-item__head">
                                    <div className="md-item__title">
                                        <span>{group.key}</span>
                                        <Badge pill className="md-badge" color="secondary">
                                            {group.value.length}
                                        </Badge>
                                    </div>
                                </div>

                                {group.value.length === 0 ? (
                                    <div className="text-muted">-</div>
                                ) : (
                                    <div className="d-flex flex-column gap-2">
                                        {group.value.map((file, idx) => (
                                            <div
                                                key={`${group.key}_${file.file_id ?? idx}`}
                                                className="d-flex justify-content-between align-items-center flex-wrap gap-2 border rounded px-3 py-2"
                                            >
                                                <div className="d-flex flex-column">
                                                    <span>{safeStr(file.original_file_name || file.fileName || '-')}</span>
                                                    {safeStr(file.note) ? (
                                                        <small className="text-danger">{file.note}</small>
                                                    ) : null}
                                                </div>

                                                <div className="d-flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        color="primary"
                                                        outline
                                                        onClick={() => onPreviewFile(file.file_url)}
                                                    >
                                                        {tt('createOrder.actions.viewFile')}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </CardBody>
            </Collapse>
        </Card>
    );
};

export default ReadOnlyFileGroupsSection;