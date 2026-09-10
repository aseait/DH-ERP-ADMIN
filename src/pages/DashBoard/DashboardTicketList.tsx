import React, { memo } from 'react';
import { Card, CardBody, CardHeader, Button } from 'reactstrap';

type DashboardTicketListProps = {
  title: string;
  tickets: any[];
  total: number;
  tt: (key: string, options?: any) => string;
  dispnumber: (e: any) => string;
  statusLabel?: React.ReactNode;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  showStatusText?: boolean;

  buttonTextKey: 'dashboard.viewDetails' | 'dashboard.goUpload';

  onTicketClick?: (row: any) => void;
};

const DashboardTicketList: React.FC<DashboardTicketListProps> = ({
  title,
  tickets,
  total,
  tt,
  dispnumber,
  statusLabel,
  onScroll,
  showStatusText = false,
  buttonTextKey,
  onTicketClick,
}) => {
  return (
    <Card>
      <CardHeader>{title}</CardHeader>
      <CardBody>
        <div className="dashboard-ticket-list" onScroll={onScroll}>
          {tickets.map((item, idx) => {
            const mainId = item?.main_id ? String(item.main_id) : '';
            const clickable = !!onTicketClick && !!mainId;

            return (
              <div
                key={idx}
                className="dashboard-ticket-item"
                style={{ cursor: clickable ? 'pointer' : 'default' }}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={() => clickable && onTicketClick?.(item)}
                onKeyDown={(e) => {
                  if (!clickable) return;
                  if (e.key === 'Enter' || e.key === ' ') onTicketClick?.(item);
                }}
              >
                <div className="dashboard-ticket-row">
                  <div className="fw-bold">
                    {tt('dashboard.cargoNo')}: {dispnumber(item)}
                  </div>

                  <Button
                    color="primary"
                    outline
                    className="dashboard-btn-120"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (clickable) onTicketClick?.(item);
                    }}
                  >
                    {tt(buttonTextKey)}
                  </Button>
                </div>

                {showStatusText && (
                  <div className="dashboard-ticket-row mt-1">
                    <div className="text-muted">
                      {tt('dashboard.status')}: <span className="text-danger">{statusLabel}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {tickets.length === 0 && <div className="text-muted">{tt('dashboard.noTickets')}</div>}
          {tickets.length < total && (
            <div className="text-muted py-2">{tt('dashboard.loadingMore')}</div>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

DashboardTicketList.displayName = 'DashboardTicketList';

export default memo(DashboardTicketList);
