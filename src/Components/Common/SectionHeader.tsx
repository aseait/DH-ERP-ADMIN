import React from 'react';

export const SectionHeader = ({
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
