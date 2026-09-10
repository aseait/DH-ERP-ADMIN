import React, { memo } from 'react';
import { Card, CardBody, CardHeader } from 'reactstrap';

type DashboardEventsProps = {
  msgList: any[];
  tt: (key: string, options?: any) => string;
};

const DashboardEvents: React.FC<DashboardEventsProps> = ({ msgList, tt }) => {
  return (
    <Card>
      <CardHeader>{tt('dashboard.recentEvents')}</CardHeader>
      <CardBody className="dashboard-events">
        {msgList.map((item, idx) => (
          <div key={idx} className="dashboard-event-item">
            <div className="dashboard-event-top">
              <div className="dashboard-event-left">
                <span className="dashboard-event-type">
                  {tt('dashboard.eventType')}: {item?.event_type}
                </span>

                <span className="dashboard-event-code">
                  (
                  {item?.awb ? (
                    <>
                      <span> {tt('dashboard.awb')}: </span>
                      <span>{item.awb}</span>
                    </>
                  ) : item?.container_number ? (
                    <>
                      <span> {tt('dashboard.containerNumber')}: </span>
                      <span>{item.container_number}</span>
                    </>
                  ) : null}
                  )
                </span>
              </div>

              <div className="dashboard-event-time">{item?.create_time}</div>
            </div>

            <div className="dashboard-event-bottom">
              <span className="dashboard-bell" aria-hidden="true">
                🔔
              </span>
              <span className="dashboard-event-text">{item?.additional_information}</span>
            </div>
          </div>
        ))}

        {msgList.length === 0 && <div className="text-muted">{tt('dashboard.noEvents')}</div>}
      </CardBody>
    </Card>
  );
};

DashboardEvents.displayName = 'DashboardEvents';

export default memo(DashboardEvents);
