import React, { useMemo } from 'react';
import { Card, CardBody, CardHeader, Button } from 'reactstrap';
import ReactApexChart from 'react-apexcharts';
import { useTT } from '../../helpers/useTT';

type Props = {
  title?: string;
  loading: boolean;
  error?: string;
  x: string[];
  y: number[];
  onRefresh: () => void;
};

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const TicketSummaryBarChart: React.FC<Props> = ({ title, loading, error, x, y, onRefresh }) => {
  const { tt } = useTT();

  const { categories, values } = useMemo(() => {
    const map: Record<string, number> = {};

    for (let i = 0; i < x.length; i++) {
      const label = String(x[i] ?? '');
      const val = Number(y[i] ?? 0) || 0;
      map[normalize(label)] = val;
    }

    const total = map['total tickets'] ?? map['total ticket'] ?? 0;
    const marine = map['marine tickets'] ?? map['marine ticket'] ?? 0;
    const air = map['air tickets'] ?? map['air ticket'] ?? 0;
    const truck = map['truck tickets'] ?? map['truck ticket'] ?? 0;

    return {
      categories: [
        tt('ticketSummary.totalTickets'),
        tt('ticketSummary.marineTickets'),
        tt('ticketSummary.airTickets'),
        tt('ticketSummary.truckTickets'),
      ],
      values: [total, marine, air, truck],
    };
  }, [x, y, tt]);

  const barSeries = useMemo(
    () => [
      {
        name: tt('ticketSummary.tickets'),
        data: values,
      },
    ],
    [values, tt]
  );

  const barOptions = useMemo<any>(
    () => ({
      chart: {
        type: 'bar',
        toolbar: { show: false },
        zoom: { enabled: false },
      },

      colors: ['#845adf', '#556ee6', '#34c38f', '#f46a6a'],

      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '45%',
          borderRadius: 6,
          distributed: true,
          dataLabels: { position: 'center' },
        },
      },

      dataLabels: {
        enabled: true,
        offsetY: 0,
        style: { fontSize: '12px', fontWeight: 600, colors: ['#fff'] },
      },

      stroke: { show: false, width: 0 },
      grid: { strokeDashArray: 4 },

      xaxis: {
        categories,
        labels: { rotate: -15 },
      },

      yaxis: {
        min: 0,
        title: { text: tt('ticketSummary.count') },
        forceNiceScale: true,
      },

      tooltip: {
        y: { formatter: (val: number) => `${val}` },
      },
    }),
    [categories, tt]
  );

  const chartKey = useMemo(
    () => `ticket-summary:${categories.join('|')}:${values.join('|')}`,
    [categories, values]
  );

  return (
    <Card className="ticket-summary-card">
      <CardHeader className="border-0 align-items-center d-flex">
        <h4 className="card-title mb-0 flex-grow-1">{title || tt('ticketSummary.title')}</h4>

        <div className="d-flex gap-2 align-items-center">
          {error ? <small className="text-danger">{String(error)}</small> : null}

          <Button color="primary" onClick={onRefresh} disabled={loading}>
            {loading ? tt('ticketSummary.loading') : tt('ticketSummary.refresh')}
          </Button>
        </div>
      </CardHeader>

      <CardBody>
        <ReactApexChart
          key={chartKey}
          dir="ltr"
          options={barOptions}
          series={barSeries}
          type="bar"
          height={370}
          className="apex-charts"
        />
      </CardBody>
    </Card>
  );
};

export default TicketSummaryBarChart;
