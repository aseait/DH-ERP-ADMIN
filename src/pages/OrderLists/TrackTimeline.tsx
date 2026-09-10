import React, { useMemo } from 'react';

export type TrackEvent = {
  id?: string | number;
  event_time?: string;
  event_type?: string;
  type?: string;
  location?: string;
  event_description?: string;
  description?: string;
  _source?: 'container' | 'train';
  // train-specific fields from marine_train_tracking
  rail_provider?: string;
  equipment_id?: string;
  train_eta?: string;
  last_free_day?: string;
  waybill_status?: string;
  tracking_status?: string;
  pickup_container_date?: string;
  return_container_date?: string;
};

type Props = {
  events: TrackEvent[];
  containerNo?: string;
  title?: string;
  tt: (k: string, options?: any) => string;
  safeStr?: (v: unknown) => string;
  newestFirst?: boolean;
};

const defaultSafeStr = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function toneOf(e: TrackEvent) {
  if (e._source === 'train') {
    const s = (e.tracking_status || '').toUpperCase();
    if (s === 'RETURNED') return 'success';
    if (s === 'PICKED_UP') return 'info';
    return 'warning';
  }
  const text =
    `${e?.event_type ?? e?.type ?? ''} ${e?.event_description ?? e?.description ?? ''}`.toLowerCase();
  if (text.includes('delay') || text.includes('exception') || text.includes('hold')) return 'danger';
  if (text.includes('arrive') || text.includes('delivered') || text.includes('release')) return 'success';
  return 'info';
}

type Chip = { label: string; value: string; highlight?: boolean };

function buildTrainChips(e: TrackEvent, safeStr: (v: unknown) => string): Chip[] {
  const chips: Chip[] = [];
  if (e.train_eta)
    chips.push({ label: 'Train ETA', value: safeStr(e.train_eta), highlight: true });
  if (e.last_free_day)
    chips.push({ label: 'Last Free Day', value: safeStr(e.last_free_day), highlight: true });
  if (e.pickup_container_date)
    chips.push({ label: 'Pickup', value: safeStr(e.pickup_container_date) });
  if (e.return_container_date)
    chips.push({ label: 'Return', value: safeStr(e.return_container_date) });
  return chips;
}

const TrackTimeline: React.FC<Props> = React.memo(
  ({ events, containerNo, title, tt, safeStr = defaultSafeStr, newestFirst = true }) => {
    const sorted = useMemo(() => {
      const copy = Array.isArray(events) ? [...events] : [];
      copy.sort((a, b) => {
        const ta = a?.event_time ? new Date(a.event_time).getTime() : 0;
        const tb = b?.event_time ? new Date(b.event_time).getTime() : 0;
        return newestFirst ? tb - ta : ta - tb;
      });
      return copy;
    }, [events, newestFirst]);

    if (!sorted.length) {
      return <div className="orderlist-track-empty">{tt('common.noData')}</div>;
    }

    const headerTitle = tt('tracking.title') || tt('orderList.table.viewTrack');
    const labelContainer = tt('tracking.containerNo') || tt('orderList.columns.containerNumber');
    const labelLocation = tt('tracking.location');

    return (
      <div className="orderlist-track">
        <div className="orderlist-track-head">
          <div>
            <div className="orderlist-track-title">{headerTitle}</div>
            <div className="orderlist-track-sub">
              {labelContainer}: <span className="cell-mono">{containerNo || '-'}</span>
            </div>
          </div>
          <div className="orderlist-track-right">
            <span className="orderlist-track-badge">
              {sorted.length} {tt('tracking.events') || 'events'}
            </span>
          </div>
        </div>

        <div className="orderlist-timeline">
          {sorted.map((e, idx) => {
            const isTrain = e._source === 'train';
            const time = e?.event_time || '-';
            const tone = toneOf(e);

            if (isTrain) {
              const statusLabel = e.tracking_status || e.waybill_status || 'Train';
              const provider = e.rail_provider || 'RAIL';
              const desc = e.event_description || e.waybill_status || '-';
              const trainChips = buildTrainChips(e, safeStr);

              return (
                <div className="orderlist-timeline-item" key={e?.id ?? idx}>
                  <div className="orderlist-timeline-left">
                    <div className={`orderlist-timeline-dot dot-${tone}`} />
                    {idx !== sorted.length - 1 && <div className="orderlist-timeline-line" />}
                  </div>

                  <div className="orderlist-timeline-card orderlist-timeline-card--train">
                    <div className="orderlist-timeline-top">
                      <div className="d-flex align-items-center gap-2">
                        <i className="mdi mdi-train orderlist-train-icon" />
                        <span className="orderlist-timeline-type">{statusLabel}</span>
                        <span className="orderlist-rail-badge">{provider}</span>
                      </div>
                      <div className="orderlist-timeline-time cell-mono">{time}</div>
                    </div>

                    {trainChips.length > 0 && (
                      <div className="orderlist-timeline-meta">
                        {trainChips.map((chip) => (
                          <span
                            key={chip.label}
                            className={`orderlist-timeline-chip${chip.highlight ? ' orderlist-timeline-chip--highlight' : ''}`}
                          >
                            {chip.label}:{' '}
                            <span className="cell-mono">{chip.value}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="orderlist-timeline-desc">{desc}</div>
                  </div>
                </div>
              );
            }

            // container event (unchanged)
            const rawType = (e?.event_type ?? e?.type ?? '').trim();
            const hasType = rawType && rawType !== '-';
            const location = e?.location || '-';
            const desc = e?.event_description || e?.description || '-';

            return (
              <div className="orderlist-timeline-item" key={e?.id ?? idx}>
                <div className="orderlist-timeline-left">
                  <div className={`orderlist-timeline-dot dot-${tone}`} />
                  {idx !== sorted.length - 1 && <div className="orderlist-timeline-line" />}
                </div>

                <div className="orderlist-timeline-card">
                  <div className="orderlist-timeline-top">
                    {hasType ? (
                      <div className="orderlist-timeline-type">{rawType}</div>
                    ) : (
                      <div />
                    )}
                    <div className="orderlist-timeline-time cell-mono">{time}</div>
                  </div>

                  <div className="orderlist-timeline-meta">
                    <span className="orderlist-timeline-chip">
                      {labelLocation}: <span className="text-muted">{location}</span>
                    </span>
                  </div>

                  <div className="orderlist-timeline-desc" title={safeStr(desc)}>
                    {desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

TrackTimeline.displayName = 'TrackTimeline';
export default TrackTimeline;
