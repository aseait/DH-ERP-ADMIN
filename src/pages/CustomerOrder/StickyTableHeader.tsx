import React, { useEffect, useRef, useState } from 'react';

/**
 * A "shadow" copy of a table's <thead> that appears fixed under the sticky
 * filter bar once the real header scrolls out of view, and disappears again
 * when the table itself scrolls past. Column widths and horizontal scroll are
 * kept in sync with the real table (so it survives column resizing / re-loads).
 *
 * The real table lives inside `scrollRef` (the horizontally-scrolling wrapper).
 * `stickySelector` points at the element the shadow header should sit below
 * (the sticky filter bar); its bottom edge is the pin line.
 */
const StickyTableHeader: React.FC<{
  scrollRef: React.RefObject<HTMLDivElement | null>;
  stickySelector?: string;
  fallbackTop?: number;
}> = ({ scrollRef, stickySelector = '.sl-sticky-filters', fallbackTop = 70 }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!scrollEl || !wrap || !inner) return;

    const realTable = scrollEl.querySelector('table') as HTMLTableElement | null;
    const realThead = realTable?.querySelector('thead') as HTMLElement | null;
    if (!realTable || !realThead) return;

    let cloneTable: HTMLTableElement | null = null;

    const pinLine = (): number => {
      const el = document.querySelector(stickySelector) as HTMLElement | null;
      const b = el ? el.getBoundingClientRect().bottom : fallbackTop;
      return Math.max(fallbackTop, b);
    };

    const buildClone = () => {
      inner.innerHTML = '';
      cloneTable = document.createElement('table');
      cloneTable.className = realTable.className;
      cloneTable.setAttribute('aria-hidden', 'true');
      const theadClone = realThead.cloneNode(true) as HTMLElement;
      theadClone.querySelectorAll('.sl-col-resizer').forEach((el) => el.remove());
      cloneTable.appendChild(theadClone);
      inner.appendChild(cloneTable);
    };

    const syncWidths = () => {
      if (!cloneTable) return;
      const realCells = realThead.querySelectorAll<HTMLElement>('tr > *');
      const cloneCells = cloneTable.querySelectorAll<HTMLElement>('thead tr > *');
      realCells.forEach((cell, i) => {
        const w = cell.getBoundingClientRect().width;
        const c = cloneCells[i];
        if (c) {
          c.style.width = `${w}px`;
          c.style.minWidth = `${w}px`;
          c.style.maxWidth = `${w}px`;
        }
      });
      cloneTable.style.width = `${realTable.getBoundingClientRect().width}px`;
    };

    const update = () => {
      const rect = scrollEl.getBoundingClientRect();
      const top = pinLine();
      const headH = realThead.getBoundingClientRect().height;
      const show = rect.top < top && rect.bottom > top + headH;

      if (show !== visibleRef.current) {
        visibleRef.current = show;
        setVisible(show);
      }
      if (show) {
        wrap.style.top = `${top}px`;
        wrap.style.left = `${rect.left}px`;
        wrap.style.width = `${scrollEl.clientWidth}px`;
        wrap.style.height = `${headH}px`;
        syncWidths();
        inner.scrollLeft = scrollEl.scrollLeft;
      }
    };

    const onHScroll = () => {
      inner.scrollLeft = scrollEl.scrollLeft;
    };

    buildClone();
    update();

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    scrollEl.addEventListener('scroll', onHScroll, { passive: true });

    // Columns can be resized or the header can re-render on data reload.
    const mo = new MutationObserver(() => {
      buildClone();
      update();
    });
    mo.observe(realThead, { childList: true, subtree: true, characterData: true });

    const ro = new ResizeObserver(() => update());
    ro.observe(realTable);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      scrollEl.removeEventListener('scroll', onHScroll);
      mo.disconnect();
      ro.disconnect();
    };
    // scrollRef.current is stable for the life of the list page
  }, []); // eslint-disable-line

  return (
    <div
      ref={wrapRef}
      className={`sl-sticky-header${visible ? ' is-visible' : ''}`}
      aria-hidden="true"
    >
      <div ref={innerRef} className="sl-sticky-header-inner" />
    </div>
  );
};

export default StickyTableHeader;
