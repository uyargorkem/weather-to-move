import {useId} from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {MONTHS, OUTDOOR_DAY_BANDS, formatCommuteRate, type CommuteWindow, type OutdoorDayBands} from '../data/types';
import {BASELINE_HEX, DATA_HEX, DATA_HEX_LIGHT, GRID_HEX, SECOND_HEX, TEXT_SECONDARY_HEX} from './chartPalette';

const axisStyle = {fontSize: 12, fill: TEXT_SECONDARY_HEX, fontFamily: 'Effra, Tahoma, sans-serif'};
const legendStyle = {fontSize: 13, fontFamily: 'Effra, Tahoma, sans-serif', color: TEXT_SECONDARY_HEX};
const legendLabel = (value: string) => <span style={{color: TEXT_SECONDARY_HEX}}>{value}</span>;
const tooltipStyle = {
  borderRadius: 4,
  border: `1px solid ${GRID_HEX}`,
  fontSize: 13,
  fontFamily: 'Effra, Tahoma, sans-serif',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
};

/** Property vs baseline, one bar pair per month. */
export function MonthlyBars({
  monthly,
  baseline,
  unit,
  propertyLabel,
  baselineLabel,
  months,
  homeFirst = false,
}: {
  monthly: number[];
  baseline: number[];
  unit: string;
  propertyLabel: string;
  baselineLabel: string;
  months: number[];
  homeFirst?: boolean;
}) {
  const data = months.map(i => ({month: MONTHS[i], property: monthly[i], baseline: baseline[i]}));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barGap={2} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={GRID_HEX} />
        <XAxis dataKey="month" interval="preserveStartEnd" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{fill: 'rgba(0,4,51,0.04)'}}
          formatter={(v, name) => {
            const value = Number(v ?? 0);
            return [unit.startsWith('%') ? formatCommuteRate(value, unit) : `${Math.round(value)} ${unit}`, String(name)];
          }}
        />
        <Legend iconType="circle" wrapperStyle={legendStyle} formatter={legendLabel}
          itemSorter={homeFirst ? entry => entry.dataKey === 'property' ? 0 : 1 : 'value'} />
        <Bar dataKey="property" name={propertyLabel} fill={DATA_HEX} radius={[4, 4, 0, 0]} maxBarSize={20} />
        <Bar dataKey="baseline" name={baselineLabel} fill={BASELINE_HEX} radius={[4, 4, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OutdoorDayBars({days, baselineLabel, annualised}: {
  days: OutdoorDayBands;
  baselineLabel: string;
  annualised: boolean;
}) {
  const series = [
    {label: 'This home', values: days.home, color: DATA_HEX},
    {label: baselineLabel, values: days.baseline, color: BASELINE_HEX},
  ];
  const max = Math.max(1, ...days.home, ...days.baseline);
  const formatDays = (value: number) => Math.round(value).toLocaleString('en-GB');
  const summary = OUTDOOR_DAY_BANDS.map((band, i) =>
    `${band}: ${formatDays(days.home[i])} days for this home, ${formatDays(days.baseline[i])} for ${baselineLabel}.`,
  ).join(' ');
  return (
    <div className="weather-outdoor-days" role="img"
      aria-label={`Outdoor time per day. ${annualised ? 'Average days per year.' : 'Days in this period.'} ${summary}`}>
      {OUTDOOR_DAY_BANDS.map((band, i) => (
        <div key={band} className="weather-outdoor-days__band">
          <span>{band}</span>
          {series.map(({label, values, color}) => (
            <div className="weather-outdoor-days__row" key={label}>
              <span className="weather-outdoor-days__bar" style={{width: `${values[i] / max * 100}%`, backgroundColor: color}} />
              <span>{formatDays(values[i])}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="weather-outdoor-days__legend">
        {series.map(({label, color}) => (
          <span key={label}><i style={{backgroundColor: color}} />{label}</span>
        ))}
      </div>
    </div>
  );
}

/** Commute wetness for the selected window, or both windows together. */
export function CommuteLines({am, pm, months, window, morningLabel, eveningLabel, unit}: {
  am: number[];
  pm: number[];
  months: number[];
  window?: CommuteWindow;
  morningLabel: string;
  eveningLabel: string;
  unit: string;
}) {
  const data = months.map(i => ({month: MONTHS[i], am: am[i] * 100, pm: pm[i] * 100}));
  const dot = (fill: string) => ({r: 4, strokeWidth: 2, stroke: '#fff', fill});
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid vertical={false} stroke={GRID_HEX} />
        <XAxis dataKey="month" interval="preserveStartEnd" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={36} unit="%" />
        <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [formatCommuteRate(Number(v ?? 0), unit), String(name)]} />
        <Legend iconType="plainline" wrapperStyle={legendStyle} formatter={legendLabel} />
        {window !== 'pm' && (
          <Line type="monotone" dataKey="am" name={morningLabel} stroke={DATA_HEX} strokeWidth={2} dot={dot(DATA_HEX)} />
        )}
        {window !== 'am' && (
          <Line type="monotone" dataKey="pm" name={eveningLabel} stroke={SECOND_HEX} strokeWidth={2} strokeDasharray="5 3" dot={dot(SECOND_HEX)} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Show the local hours included in the comfort metric, from 08:00 to 20:00. */
export function ComfortHeatmap({heat, months}: {heat: number[][]; months: number[]}) {
  const startHour = 8;
  const endHour = 20;
  const cell = 24;
  const gap = 2;
  const left = 36;
  const top = 18;
  const width = left + (endHour - startHour) * (cell + gap);
  const height = top + months.length * (cell + gap);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      role="img"
      aria-label="Comfortable hours by month and hour of day"
      style={{fontFamily: 'Effra, Tahoma, sans-serif'}}>
      {[8, 10, 12, 14, 16, 18].map(hour => (
        <text key={hour} x={left + (hour - startHour) * (cell + gap) + cell / 2} y={12} fontSize={13} fill={TEXT_SECONDARY_HEX} textAnchor="middle">
          {String(hour).padStart(2, '0')}:00
        </text>
      ))}
      {months.map((month, m) => (
        <g key={m}>
          <text x={left - 8} y={top + m * (cell + gap) + cell / 2 + 4} fontSize={13} fill={TEXT_SECONDARY_HEX} textAnchor="end">
            {MONTHS[month]}
          </text>
          {heat[month].slice(startHour, endHour).map((v, h) => {
            return (
              <rect
                key={h}
                x={left + h * (cell + gap)}
                y={top + m * (cell + gap)}
                width={cell}
                height={cell}
                rx={2}
                fill={DATA_HEX}
                fillOpacity={0.08 + v * 0.92}>
                <title>{`${MONTHS[month]} ${String(h + startHour).padStart(2, '0')}:00 — comfortable ${Math.round(v * 100)}% of the time`}</title>
              </rect>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** Polar bars: hours of wind-driven rain per year arriving from each direction. */
export function WindRose({rose, annualised}: {rose: number[]; annualised: boolean}) {
  return <DirectionRose values={rose} label="Wind-driven rain by direction"
    format={value => `${value} h${annualised ? ' / yr' : ''} of wind-driven rain`} />;
}

export function WindSpeedRose({speeds}: {speeds: (number | null)[]}) {
  const max = Math.max(60, Math.ceil(Math.max(...speeds.map(speed => speed ?? 0)) / 20) * 20);
  return <DirectionRose values={speeds} label="Average wind speed by direction"
    format={value => `${value.toLocaleString('en-GB', {maximumFractionDigits: 1})} km/h`} scale={max} />;
}

function DirectionRose({values, label, format, scale}: {
  values: (number | null)[];
  label: string;
  format: (value: number) => string;
  scale?: number;
}) {
  const descriptionId = useId();
  const size = 260;
  const c = size / 2;
  const rMax = c - 28;
  const max = scale ?? Math.max(...values.map(value => value ?? 0), 1);
  const rings = [0.25, 0.5, 0.75, 1];
  const step = (Math.PI * 2) / 16;
  const arc = (i: number, r: number) => {
    const a0 = i * step - step / 2 - Math.PI / 2;
    const a1 = a0 + step;
    const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0);
    const x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
    return `M${c},${c} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`;
  };
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      style={{maxWidth: 320, fontFamily: 'Effra, Tahoma, sans-serif'}}
      role="img"
      aria-label={label}
      aria-describedby={descriptionId}>
      <desc id={descriptionId}>
        {values.map((value, i) => value ? `${DIRS[i]}: ${format(value)}.` : '').filter(Boolean).join(' ') || 'No matching hours.'}
      </desc>
      {rings.map(f => (
        <circle key={f} cx={c} cy={c} r={rMax * f} fill="none" stroke={GRID_HEX} />
      ))}
      {values.map((v, i) => v ? (
        <path key={i} d={arc(i, (v / max) * rMax)} fill={DATA_HEX} fillOpacity={0.85} stroke="#fff" strokeWidth={2}>
          <title>{`${DIRS[i]}: ${format(v)}`}</title>
        </path>
      ) : null)}
      {scale && rings.map(f => (
        <text key={f} x={c + 4} y={c - rMax * f + 4} fontSize={10} fill={TEXT_SECONDARY_HEX}
          stroke="#fff" strokeWidth={3} paintOrder="stroke" pointerEvents="none">
          {scale * f}
        </text>
      ))}
      {DIRS.map((d, i) =>
        i % 2 === 0 ? (
          <text
            key={d}
            x={c + (rMax + 14) * Math.cos(i * step - Math.PI / 2)}
            y={c + (rMax + 14) * Math.sin(i * step - Math.PI / 2) + 4}
            fontSize={11}
            fill={TEXT_SECONDARY_HEX}
            textAnchor="middle">
            {d}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Same-ramp meter: usable afternoons out of total for a season. */
export function SeasonMeter({usable, total}: {usable: number; total: number}) {
  const pct = (usable / total) * 100;
  return (
    <div style={{height: 8, borderRadius: 4, background: DATA_HEX_LIGHT, overflow: 'hidden'}}>
      <div style={{width: `${pct}%`, height: '100%', background: DATA_HEX}} />
    </div>
  );
}
