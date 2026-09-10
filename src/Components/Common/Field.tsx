import React from 'react';

type Props = {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
};

const Field = ({ label, children, hint, className }: Props) => {
  return (
    <div className={`md-field ${className ?? ''}`}>
      <div className="md-field__label">{label}</div>
      <div className="md-field__control">{children}</div>
      {hint ? <div className="md-field__hint">{hint}</div> : null}
    </div>
  );
};

export default Field;
