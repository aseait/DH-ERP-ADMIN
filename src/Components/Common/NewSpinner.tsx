import React, { useEffect } from 'react';
import { Spinner } from 'reactstrap';
type SpinnersProps = {
  size?: 'sm' | 'md' | 'lg';
  setLoading?: (v: boolean) => void;
};

const Spinners: React.FC<SpinnersProps> = ({ size = 'lg', setLoading }) => {
  useEffect(() => {
    if (!setLoading) return;
    const t = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(t);
  }, [setLoading]);

  return (
    <div className="spinner-overlay">
      <Spinner color="primary" className={`spinner-${size}`} />
    </div>
  );
};

export default Spinners;
