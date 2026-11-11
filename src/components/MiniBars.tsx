import {MONTHS} from '../data/types';
import {DATA_HEX, INK_HEX} from './chartPalette';

interface Props {
  values: number[];
  baseline: number[];
  baselineLabel: string;
  unit: string;
}

/** Twelve monthly bars with the baseline drawn across each bar. */
export function MiniBars({values, baseline, baselineLabel, unit}: Props) {
  const max = Math.max(...values, ...baseline, 1);
  const height = 36;
  const w = 100;
  const gap = 1.2;
  const bw = (w - gap * 11) / 12;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Monthly averages (${unit}), this address versus ${baselineLabel}. ${values.map((v, i) => `${MONTHS[i]}: ${Math.round(v)} versus ${Math.round(baseline[i])}`).join(', ')}`}>
      {values.map((v, i) => {
        const x = i * (bw + gap);
        const h = (v / max) * (height - 2);
        const y = height - 1 - (baseline[i] / max) * (height - 2);
        return (
          <g key={i}>
            <rect x={x} y={height - 1 - h} width={bw} height={h} fill={DATA_HEX} rx={0.6} />
            <line x1={x} x2={x + bw} y1={y} y2={y} stroke={INK_HEX} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </svg>
  );
}
