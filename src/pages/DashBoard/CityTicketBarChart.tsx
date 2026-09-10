import React, { useMemo } from 'react';
import { Card, CardBody, CardHeader, Button } from 'reactstrap';
import ReactApexChart from 'react-apexcharts';
import { useTT } from '../../helpers/useTT';

type Props = {
  loading: boolean;
  error?: string;
  x: string[];
  y: Record<string, number[]>;
  onRefresh: () => void;
};

const COLORS = ['#409EFF', '#95D475', '#FFA14F'];

const CityTicketBarChart: React.FC<Props> = ({ loading, error, x, y, onRefresh }) => {
  const { tt } = useTT();

  const series = useMemo(
    () =>
      Object.entries(y).map(([name, data], i) => ({
        name,
        data,
        color: COLORS[i % COLORS.length],
      })),
    [y]
  );

  const options = useMemo<any>(
    () => ({
      chart: {
        type: 'bar',
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: '55%',
          borderRadius: 4,
          dataLabels: { position: 'top' },
        },
      },
      dataLabels: {
        enabled: true,
        offsetY: -18,
        style: { fontSize: '10px', fontWeight: 600, colors: ['#333'] },
        formatter: (val: number) => (val === 0 ? '' : String(val)),
      },
      stroke: { show: false },
      grid: { strokeDashArray: 4 },
      xaxis: {
        categories: x,
        labels: { rotate: -30, style: { fontSize: '11px' } },
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        title: { text: tt('work.count') },
      },
      legend: { position: 'top' as const },
      tooltip: {
        y: { formatter: (val: number) => `${val}` },
      },
    }),
    [x, tt]
  );

  // Each city group needs ~120px to give 3 bars + labels enough room.
  const chartWidth = Math.max(700, x.length * 120);

  return (
    <Card className="h-100">
      <CardHeader className="border-0 d-flex align-items-center">
        <h4 className="card-title mb-0 flex-grow-1">{tt('work.cityOrders')}</h4>
        <div className="d-flex gap-2 align-items-center">
          {error && <small className="text-danger">{error}</small>}
          <Button color="primary" onClick={onRefresh} disabled={loading}>
            {loading ? tt('work.loading') : tt('work.refresh')}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="p-0 dashboard-chart-scroll">
        {series.length === 0 && !loading ? (
          <div className="text-center text-muted py-5">{tt('work.noData')}</div>
        ) : (
          <div className="dashboard-chart-inner" style={{ width: chartWidth }}>
            <ReactApexChart
              key={`city:${x.join('|')}`}
              dir="ltr"
              options={options}
              series={series}
              type="bar"
              height={350}
              className="apex-charts"
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default CityTicketBarChart;
