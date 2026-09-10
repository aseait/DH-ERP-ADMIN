import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTT } from '../../helpers/useTT';

type DragCaptchaProps = {
  value?: boolean;
  onChange?: (val: boolean) => void;
  startText?: string;
  successText?: string;
};

export type DragCaptchaRef = {
  resetResult: () => void;
};

const DragCaptcha = forwardRef<DragCaptchaRef, DragCaptchaProps>(
  ({ value = false, onChange, startText, successText }, ref) => {
    const { tt } = useTT();

    const realStartText = startText ?? tt('captcha.slide');
    const realSuccessText = successText ?? tt('captcha.success');

    const [verifyResult, setVerifyResult] = useState<boolean>(value);
    const [dragX, setDragX] = useState<number>(0);
    const [dragging, setDragging] = useState<boolean>(false);

    const rangeRef = useRef<HTMLDivElement | null>(null);
    const currentXRef = useRef<number>(0);

    useEffect(() => {
      setVerifyResult(value);
      if (!value) {
        setDragX(0);
        currentXRef.current = 0;
      }
    }, [value]);

    const resetResult = () => {
      setVerifyResult(false);
      setDragX(0);
      currentXRef.current = 0;
      setDragging(false);
      onChange?.(false);
    };

    useImperativeHandle(ref, () => ({
      resetResult,
    }));

    const getClientX = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
      if ('touches' in e && e.touches.length > 0) {
        return e.touches[0].clientX;
      }
      if ('changedTouches' in e && e.changedTouches.length > 0) {
        return e.changedTouches[0].clientX;
      }
      return (e as MouseEvent).clientX;
    };

    const onStart = (ev: React.MouseEvent | React.TouchEvent) => {
      if (verifyResult) return;

      const rangeEl = rangeRef.current;
      if (!rangeEl) return;

      const iconWidth = 45;
      const maxX = rangeEl.offsetWidth - iconWidth;
      const startX = getClientX(ev);
      const initialX = currentXRef.current;

      setDragging(true);

      const onMove = (e: MouseEvent | TouchEvent) => {
        const currentX = getClientX(e);
        let nextX = initialX + (currentX - startX);

        if (nextX < 0) nextX = 0;
        if (nextX > maxX) nextX = maxX;

        currentXRef.current = nextX;
        setDragX(nextX);
      };

      const onEnd = () => {
        setDragging(false);

        const finalX = currentXRef.current;
        const successThreshold = maxX - 2;

        if (finalX >= successThreshold) {
          currentXRef.current = maxX;
          setDragX(maxX);
          setVerifyResult(true);
          onChange?.(true);
        } else {
          currentXRef.current = 0;
          setDragX(0);
          setVerifyResult(false);
          onChange?.(false);
        }

        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: true });
      document.addEventListener('touchend', onEnd);
    };

    return (
      <div className="drag-verify-react">
        <div ref={rangeRef} className={`drag-range ${verifyResult ? 'success' : ''}`}>
          <div
            className={`drag-block ${dragging ? 'dragging' : ''}`}
            style={{ transform: `translateX(${dragX}px)` }}
          >
            <div className="drag-icon" onMouseDown={onStart} onTouchStart={onStart}>
              {!verifyResult ? <span>&raquo;</span> : <span>✓</span>}
            </div>
          </div>

          <span className="drag-text">{verifyResult ? realSuccessText : realStartText}</span>
        </div>
      </div>
    );
  }
);

DragCaptcha.displayName = 'DragCaptcha';

export default DragCaptcha;
