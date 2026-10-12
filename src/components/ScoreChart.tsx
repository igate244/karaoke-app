import type { Machine, ScoreLog } from '../types';
import { fmtDate, fmtScore } from './ui';

const COLORS: Record<Machine, string> = {
  DAM: 'var(--dam)',
  JOYSOUND: 'var(--joy)',
  その他: 'var(--other)',
};

/** 得点推移（機種別に色分けした折れ線） */
export function ScoreChart({ logs }: { logs: ScoreLog[] }) {
  const pts = logs
    .filter((l) => l.score != null)
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
  if (pts.length < 2) return null;

  const W = 340;
  const H = 160;
  const pad = { l: 34, r: 12, t: 12, b: 24 };
  const scores = pts.map((p) => p.score as number);
  let min = Math.floor(Math.min(...scores) - 2);
  let max = Math.ceil(Math.max(...scores) + 1);
  min = Math.max(0, min);
  max = Math.min(100, Math.max(max, min + 5));
  const x = (i: number) => pad.l + (pts.length === 1 ? 0 : (i / (pts.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);

  const machines = [...new Set(pts.map((p) => p.machine))];
  const ticks = [min, Math.round((min + max) / 2), max];

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="得点の推移">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="tick">
              {t}
            </text>
          </g>
        ))}
        {machines.map((m) => {
          const idx = pts.map((p, i) => ({ p, i })).filter(({ p }) => p.machine === m);
          const d = idx.map(({ p, i }, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score as number).toFixed(1)}`).join(' ');
          return (
            <g key={m}>
              {idx.length > 1 && <path d={d} fill="none" stroke={COLORS[m]} strokeWidth={2} strokeLinejoin="round" />}
              {idx.map(({ p, i }) => (
                <circle key={p.id} cx={x(i)} cy={y(p.score as number)} r={3.5} fill={COLORS[m]}>
                  <title>
                    {fmtDate(p.date)} {m} {fmtScore(p.score)}点
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
        <text x={pad.l} y={H - 6} className="tick">
          {fmtDate(pts[0].date)}
        </text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" className="tick">
          {fmtDate(pts[pts.length - 1].date)}
        </text>
      </svg>
      <figcaption className="legend">
        {machines.map((m) => (
          <span key={m}>
            <i style={{ background: COLORS[m] }} />
            {m}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
