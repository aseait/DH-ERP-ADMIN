import React from 'react';

const TicketHeader = ({
  tt,
  stepActive,
  ticketType,
}: {
  tt: (k: string) => string;
  stepActive: number;
  ticketType: string;
}) => {
  const steps = [
    { title: tt('state.order.reviewing'), i: 0 },
    { title: tt('state.order.processing'), i: 1 },
    { title: tt('state.order.completed'), i: 2 },
  ];

  const getServiceLabel = (type: string) => {
    switch (type) {
      case 'Marine':
        return tt('createOrder.services.marine');
      case 'Air':
        return tt('createOrder.services.air');
      case 'Truck':
        return tt('createOrder.services.truck');
      case 'parse':
        return tt('createOrder.services.parse');
      default:
        return null;
    }
  };

  return (
    <>
      <div className="md-summary">
        <div className="md-summary__title">
          {tt('createOrder.services.serviceTitle')}
          <span className="md-chip">{getServiceLabel(ticketType)}</span>
        </div>
      </div>

      {/* md-steps temporarily hidden
      <div className="md-steps">
        {steps.map((s) => {
          const done = stepActive > s.i;
          const active = stepActive === s.i;
          return (
            <div
              key={s.i}
              className={`md-step ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}
            >
              <div className="md-step__dot" />
              <div className="md-step__text">
                <div className="md-step__title">{s.title}</div>
                <div className="md-step__desc">{tt('steps.description')}</div>
              </div>
            </div>
          );
        })}
      </div>
      */}
    </>
  );
};

export default TicketHeader;
