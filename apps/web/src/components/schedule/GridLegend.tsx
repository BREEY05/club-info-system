import { heatColorOf } from '../../lib/colors';

/** 空闲热度图例：与网格共用同一套连续色阶 */
const STOPS = [
  { label: '无空闲', free: 0, total: 1 },
  { label: '<50%', free: 35, total: 100 },
  { label: '50-75%', free: 60, total: 100 },
  { label: '75-100%', free: 85, total: 100 },
  { label: '全员空闲', free: 1, total: 1 },
];

export function GridLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-2xs text-muted">
      <span className="font-medium text-subtle">空闲热度</span>
      {STOPS.map((stop) => {
        const color = heatColorOf(stop.free, stop.total);
        return (
          <span key={stop.label} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-[4px] border"
              style={{ backgroundColor: color.background, borderColor: color.border }}
              aria-hidden
            />
            <span className="tabular">{stop.label}</span>
          </span>
        );
      })}
    </div>
  );
}
